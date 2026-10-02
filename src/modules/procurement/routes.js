import { Router } from 'express';
import { authorize } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validation.js';
import * as db from '../../models/index.js';

const router = Router();

const MANAGER = ['Admin', 'SuperAdmin', 'Pharmacy', 'Finance'];

// ---------- Suppliers ----------
router.get('/suppliers', authorize(MANAGER), (req, res) => {
  try {
    const suppliers = db.getDb().prepare(`
      SELECT s.*,
             (SELECT COUNT(*) FROM purchase_orders po WHERE po.supplier_id = s.id) AS order_count,
             (SELECT COALESCE(SUM(po.total_amount), 0) FROM purchase_orders po WHERE po.supplier_id = s.id) AS total_spend
        FROM suppliers s
       ORDER BY s.name
    `).all();
    res.json({ suppliers });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/suppliers', authorize(MANAGER), validate('supplier'), (req, res) => {
  try {
    const v = req.validated;
    const r = db.getDb().prepare(`
      INSERT INTO suppliers (name, contact_person, email, phone, address, lead_time_days, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      v.name, v.contact_person ?? null, v.email || null, v.phone ?? null,
      v.address ?? null, v.lead_time_days ?? 7, v.active === false ? 0 : 1
    );
    const supplier = db.getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(r.lastInsertRowid);
    db.createAuditLog({
      actor_id: req.user.id, action: 'CREATE', resource_type: 'supplier',
      resource_id: r.lastInsertRowid, details: `Added supplier ${v.name}`, ip_address: req.ip,
    });
    res.status(201).json({ success: true, supplier });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/suppliers/:id', authorize(MANAGER), validate('supplierUpdate'), (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Supplier not found' });

    const v = req.validated;
    db.getDb().prepare(`
      UPDATE suppliers
         SET name = ?, contact_person = ?, email = ?, phone = ?,
             address = ?, lead_time_days = ?, active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
    `).run(
      v.name ?? existing.name,
      v.contact_person ?? existing.contact_person,
      v.email === '' ? null : (v.email ?? existing.email),
      v.phone ?? existing.phone,
      v.address ?? existing.address,
      v.lead_time_days ?? existing.lead_time_days,
      v.active === undefined ? existing.active : (v.active ? 1 : 0),
      id
    );
    res.json({ success: true, supplier: db.getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Purchase orders ----------
router.get('/purchase-orders', authorize(MANAGER), (req, res) => {
  try {
    const { status } = req.query;
    const orders = db.getDb().prepare(`
      SELECT po.*, s.name AS supplier_name, u.full_name AS ordered_by_name
        FROM purchase_orders po
        JOIN suppliers s ON s.id = po.supplier_id
        LEFT JOIN users u ON u.id = po.ordered_by
       WHERE (? IS NULL OR po.status = ?)
       ORDER BY po.created_at DESC
    `).all(status || null, status || null);

    const items = db.getDb().prepare(`
      SELECT poi.*, m.name AS medication_name, m.strength
        FROM purchase_order_items poi
        LEFT JOIN medications m ON m.id = poi.medication_id
    `).all();

    res.json({
      orders: orders.map(o => ({ ...o, items: items.filter(i => i.purchase_order_id === o.id) })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/purchase-orders', authorize(MANAGER), validate('purchaseOrder'), (req, res) => {
  try {
    const v = req.validated;
    const supplier = db.getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(v.supplier_id);
    if (!supplier) return res.status(400).json({ error: 'Unknown supplier' });

    const total = v.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
    const orderNumber = `PO-${Date.now().toString().slice(-8)}`;

    // Header and line items must land together; a partial order is worse than none.
    db.getDb().exec('BEGIN');
    try {
      const r = db.getDb().prepare(`
        INSERT INTO purchase_orders (order_number, supplier_id, status, total_amount, expected_date, ordered_by)
        VALUES (?, ?, 'SUBMITTED', ?, ?, ?)
      `).run(orderNumber, v.supplier_id, total, v.expected_date || null, req.user.id);

      const poId = r.lastInsertRowid;
      const insertItem = db.getDb().prepare(`
        INSERT INTO purchase_order_items (purchase_order_id, medication_id, item_name, quantity, unit_cost)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const i of v.items) {
        insertItem.run(poId, i.medication_id ?? null, i.item_name, i.quantity, i.unit_cost);
      }
      db.getDb().exec('COMMIT');

      db.createAuditLog({
        actor_id: req.user.id, action: 'CREATE', resource_type: 'purchase_order',
        resource_id: poId, details: `Raised ${orderNumber} with ${supplier.name} for $${total.toFixed(2)}`,
        ip_address: req.ip,
      });
      res.status(201).json({ success: true, order_id: poId, order_number: orderNumber, total_amount: total });
    } catch (inner) {
      db.getDb().exec('ROLLBACK');
      throw inner;
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/purchase-orders/:id/status', authorize(MANAGER), (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const allowed = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const order = db.getDb().prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!order) return res.status(404).json({ error: 'Purchase order not found' });

    db.getDb().prepare('UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    res.json({ success: true, order: db.getDb().prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Procurement summary (drives the Inventory "reports" tab) ----------
router.get('/reports', authorize(MANAGER), (req, res) => {
  try {
    const stock = db.getDb().prepare(`
      SELECT i.medication_id, m.name AS medication_name, m.strength, m.unit_price,
             COALESCE(SUM(i.quantity), 0) AS total_quantity,
             COALESCE(SUM(i.quantity * i.unit_cost), 0) AS stock_value,
             MIN(i.expiry_date) AS earliest_expiry,
             COUNT(*) AS batch_count
        FROM pharmacy_inventory i
        LEFT JOIN medications m ON m.id = i.medication_id
       GROUP BY i.medication_id
       ORDER BY stock_value DESC
    `).all();

    const totals = db.getDb().prepare(`
      SELECT
        (SELECT COUNT(*) FROM suppliers) AS supplier_count,
        (SELECT COUNT(*) FROM purchase_orders) AS purchase_order_count,
        (SELECT COUNT(*) FROM purchase_orders WHERE status IN ('SUBMITTED','APPROVED','ORDERED')) AS open_order_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE status != 'CANCELLED') AS committed_spend,
        (SELECT COALESCE(SUM(quantity * unit_cost), 0) FROM pharmacy_inventory) AS stock_value
    `).get();

    res.json({ stock, totals });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;