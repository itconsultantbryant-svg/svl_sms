import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const transportRouter = Router();

// Apply tenant middleware to ALL routes
transportRouter.use(injectTenant);
transportRouter.use(requireTenant);

// Vehicles
transportRouter.get('/vehicles', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const vehicles = db.prepare(`
    SELECT v.*, b.branch_name,
      (SELECT COUNT(*) FROM transport_routes WHERE vehicle_id = v.id AND is_active = 1) as route_count
    FROM vehicles v
    LEFT JOIN branches b ON v.branch_id = b.id
    WHERE v.institution_id = ?
    ORDER BY v.vehicle_number
  `).all(req.institution_id);
  res.json(vehicles);
});

transportRouter.post('/vehicles', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { vehicle_number, model, driver_name, driver_phone, driver_license, capacity, branch_id, insurance_expiry, notes } = req.body;
  if (!vehicle_number) { res.status(400).json({ error: 'Vehicle number is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO vehicles (id, institution_id, vehicle_number, model, driver_name, driver_phone, driver_license, capacity, branch_id, insurance_expiry, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.institution_id, vehicle_number, model || null, driver_name || null, driver_phone || null, driver_license || null, capacity || 0, branch_id || null, insurance_expiry || null, notes || null);
  res.status(201).json({ id, message: 'Vehicle added' });
});

transportRouter.put('/vehicles/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { vehicle_number, model, driver_name, driver_phone, driver_license, capacity, status, insurance_expiry, notes } = req.body;
  const db = getDatabase();
  db.prepare(`UPDATE vehicles SET vehicle_number = COALESCE(?, vehicle_number), model = COALESCE(?, model), driver_name = COALESCE(?, driver_name), driver_phone = COALESCE(?, driver_phone), driver_license = COALESCE(?, driver_license), capacity = COALESCE(?, capacity), status = COALESCE(?, status), insurance_expiry = COALESCE(?, insurance_expiry), notes = COALESCE(?, notes) WHERE id = ?`).run(vehicle_number, model, driver_name, driver_phone, driver_license, capacity, status, insurance_expiry, notes, id);
  res.json({ message: 'Vehicle updated' });
});

// Routes
transportRouter.get('/routes', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const routes = db.prepare(`
    SELECT tr.*, v.vehicle_number, v.driver_name,
      (SELECT COUNT(*) FROM student_transport WHERE route_id = tr.id) as student_count
    FROM transport_routes tr
    LEFT JOIN vehicles v ON tr.vehicle_id = v.id
    WHERE tr.institution_id = ? AND tr.is_active = 1
    ORDER BY tr.name
  `).all(req.institution_id);
  res.json(routes);
});

transportRouter.post('/routes', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, vehicle_id, branch_id, fare, description } = req.body;
  if (!name) { res.status(400).json({ error: 'Route name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO transport_routes (id, institution_id, name, vehicle_id, branch_id, fare, description) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, req.institution_id, name, vehicle_id || null, branch_id || null, fare || 0, description || null);
  res.status(201).json({ id, message: 'Route created' });
});

transportRouter.put('/routes/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, vehicle_id, fare, description, is_active } = req.body;
  const db = getDatabase();
  db.prepare(`UPDATE transport_routes SET name = COALESCE(?, name), vehicle_id = COALESCE(?, vehicle_id), fare = COALESCE(?, fare), description = COALESCE(?, description), is_active = COALESCE(?, is_active) WHERE id = ?`).run(name, vehicle_id, fare, description, is_active, id);
  res.json({ message: 'Route updated' });
});

// Route Stops
transportRouter.get('/routes/:routeId/stops', (req: AuthRequest, res: Response) => {
  const { routeId } = req.params;
  const db = getDatabase();
  const stops = db.prepare('SELECT * FROM route_stops WHERE route_id = ? ORDER BY sort_order').all(routeId);
  res.json(stops);
});

transportRouter.post('/routes/:routeId/stops', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { routeId } = req.params;
  const { name, pickup_time, drop_time, sort_order } = req.body;
  if (!name) { res.status(400).json({ error: 'Stop name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO route_stops (id, route_id, name, pickup_time, drop_time, sort_order) VALUES (?, ?, ?, ?, ?, ?)`).run(id, routeId, name, pickup_time || null, drop_time || null, sort_order || 0);
  res.status(201).json({ id, message: 'Stop added' });
});

// Student Transport Assignment
transportRouter.get('/students', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { route_id, session_id } = req.query as any;
  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (route_id) { where += ' AND st.route_id = ?'; params.push(route_id); }
  if (session_id) { where += ' AND st.session_id = ?'; params.push(session_id); }

  const assignments = db.prepare(`
    SELECT st.*, s.first_name, s.last_name, s.admission_number,
      c.name as class_name, tr.name as route_name, rs.name as stop_name
    FROM student_transport st
    JOIN students s ON st.student_id = s.id
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN transport_routes tr ON st.route_id = tr.id
    LEFT JOIN route_stops rs ON st.stop_id = rs.id
    ${where} ORDER BY s.first_name
  `).all(...params);
  res.json(assignments);
});

transportRouter.post('/students', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { student_id, route_id, stop_id, session_id, pickup, dropoff } = req.body;
  if (!student_id || !route_id || !session_id) {
    res.status(400).json({ error: 'Student, route and session are required' });
    return;
  }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT OR REPLACE INTO student_transport (id, student_id, route_id, stop_id, session_id, pickup, dropoff) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, student_id, route_id, stop_id || null, session_id, pickup !== undefined ? pickup : 1, dropoff !== undefined ? dropoff : 1);
  res.status(201).json({ id, message: 'Student assigned to route' });
});
