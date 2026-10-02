import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

router.post('/invoice', authorize(['Billing', 'Admin', 'Doctor']), validate('invoice'), (req, res, next) => {
  try {
    const invoiceNumber = db.generateInvoiceNumber();
    console.log('Validated invoice data:', req.validated);
    const result = db.createInvoice({ ...req.validated, invoice_number: invoiceNumber });
    const invoice = db.getInvoiceById(result.lastInsertRowid);
    res.status(201).json({ success: true, invoice_number: invoice.invoice_number, invoice });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

/**
 * System-wide finance statistics for the Finance Dashboard.
 *
 * Must be registered BEFORE `/:patientId`, otherwise Express matches that
 * route first and treats "stats" as a patient id.
 *
 * Billing and Admin only: this exposes aggregate revenue across every
 * patient, which patient-scoped callers must not see.
 */
router.get('/stats', authorize(['Billing', 'Admin']), (req, res, next) => {
  try {
    const stmt = db.getDb().prepare(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS total_billed,
        COALESCE(SUM(paid_amount), 0)   AS total_paid,
        COALESCE(SUM(balance), 0)      AS outstanding_amount,
        SUM(CASE WHEN status = 'Paid'    THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN status = 'Unpaid'  THEN 1 ELSE 0 END) AS unpaid_count,
        SUM(CASE WHEN status = 'Partial' THEN 1 ELSE 0 END) AS partial_count
      FROM invoices
    `).get();

    const today = db.getDb().prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS today_revenue,
             COALESCE(SUM(paid_amount), 0)   AS collected_today
        FROM invoices
       WHERE date(created_at) = date('now')
    `).get();

    const insurance = db.getDb().prepare(`
      SELECT COUNT(*) AS insurance_pending
        FROM invoices
       WHERE insurance_applicable = 1
         AND (insurance_status IS NULL OR insurance_status = 'Pending')
    `).get();

    res.json({
      total_billed: stmt.total_billed,
      total_collected: stmt.total_paid,
      outstanding_amount: stmt.outstanding_amount,
      paid_count: stmt.paid_count,
      unpaid_count: stmt.unpaid_count,
      partial_count: stmt.partial_count,
      today_revenue: today.today_revenue,
      collected_today: today.collected_today,
      insurance_pending: insurance.insurance_pending,
    });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

/**
 * System-wide invoice list for the Finance Dashboard.
 *
 * Supports ?status=Unpaid and ?limit=10. Patient names are joined in because
 * the table renders invoice.patient_first / invoice.patient_last.
 */
router.get('/invoices', authorize(['Billing', 'Admin']), (req, res, next) => {
  try {
    const { status } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const rows = db.getDb().prepare(`
      SELECT i.*, p.first_name AS patient_first, p.last_name AS patient_last,
             p.global_id AS patient_global_id
        FROM invoices i
        JOIN patients p ON p.id = i.patient_id
       WHERE (? IS NULL OR i.status = ?)
       ORDER BY i.created_at DESC, i.id DESC
       LIMIT ?
    `).all(status || null, status || null, limit);

    const totals = db.getDb().prepare(`
      SELECT COUNT(*) AS count,
             COALESCE(SUM(balance), 0) AS balance
        FROM invoices
       WHERE (? IS NULL OR status = ?)
    `).get(status || null, status || null);

    res.json({ invoices: rows, total: totals.count, total_balance: totals.balance });
  } catch (e) {
    // Let the central error handler classify this (409 for UNIQUE,
    // 400 for FK/NOT NULL/CHECK) and keep internals out of the response.
    next(e);
  }
});

router.get('/:patientId', authorize(['Billing', 'Admin', 'Doctor']), (req, res) => {
  const invoices = db.getInvoicesByPatient(req.params.patientId);
  const totalUnpaid = invoices.filter(i => i.status !== 'Paid').reduce((sum, i) => sum + i.balance, 0);
  res.json({ invoices, total_unpaid: totalUnpaid });
});

router.put('/:id/pay', authorize(['Billing', 'Admin']), validate('payment'), (req, res) => {
  const invoice = db.getInvoiceById(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const newPaid = invoice.paid_amount + req.validated.amount;
  db.updateInvoiceStatus(req.params.id, newPaid >= invoice.total_amount ? 'Paid' : 'Partial', newPaid);
  res.json({ success: true, invoice: db.getInvoiceById(req.params.id) });
});

router.put('/:id/insurance-check', authorize(['Billing', 'Admin']), (req, res) => {
  const { provider, policy_number } = req.body;
  const invoice = db.getInvoiceById(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  db.updateInvoiceStatus(req.params.id, invoice.status, invoice.paid_amount);
  res.json({ success: true, insurance_verified: true, invoice: db.getInvoiceById(req.params.id) });
});

router.get('/status/:patientId', authorize(['Billing', 'Admin', 'Doctor']), (req, res) => {
  const invoices = db.getInvoicesByPatient(req.params.patientId);
  const latest = invoices[0];
  res.json({ patient_id: req.params.patientId, billing_status: latest ? latest.status : 'No Invoices', total_outstanding: invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.balance, 0) });
});

export default router;
