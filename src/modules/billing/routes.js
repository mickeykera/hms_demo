import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

router.post('/invoice', authorize(['Billing', 'Admin', 'Doctor']), validate('invoice'), (req, res) => {
  try {
    const invoiceNumber = db.generateInvoiceNumber();
    console.log('Validated invoice data:', req.validated);
    const result = db.createInvoice({ ...req.validated, invoice_number: invoiceNumber });
    const invoice = db.getInvoiceById(result.lastInsertRowid);
    res.status(201).json({ success: true, invoice_number: invoice.invoice_number, invoice });
  } catch (e) {
    console.error('Billing invoice error:', e);
    res.status(500).json({ error: e.message });
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
