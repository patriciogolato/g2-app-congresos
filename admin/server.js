/* ============================================================
   G2 Congresos — backend mínimo
   - Sirve la app de asistentes (public/) y el panel admin (admin/)
   - API pública: config del congreso + validación de credencial
   - API admin (con token): editar branding/herramientas/notificaciones/
     info, y subir el Excel del listado de personas habilitadas
   ============================================================ */
const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "g2demo2026";
const DATA_DIR = path.join(__dirname, "data", "congresos");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/admin", express.static(path.join(__dirname, "admin")));

/* ---------- sesiones simples en memoria (alcanza para uso interno) ---------- */
const tokens = new Set();
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token || !tokens.has(token)) return res.status(401).json({ error: "No autorizado. Iniciá sesión de nuevo." });
  next();
}

/* ---------- almacenamiento por congreso (un .json por evento) ---------- */
function congresoPath(id) {
  return path.join(DATA_DIR, `${id}.json`);
}
function loadCongreso(id) {
  const file = congresoPath(id);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function saveCongreso(id, data) {
  fs.writeFileSync(congresoPath(id), JSON.stringify(data, null, 2));
}
function listCongresos() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

/* ============================================================
   AUTENTICACIÓN ADMIN
   ============================================================ */
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Clave incorrecta" });
  const token = crypto.randomBytes(24).toString("hex");
  tokens.add(token);
  res.json({ token });
});

/* ============================================================
   API PÚBLICA (la consume la app de asistentes)
   ============================================================ */
app.get("/api/congresos", (req, res) => {
  res.json(listCongresos());
});

app.get("/api/congresos/:id", (req, res) => {
  const c = loadCongreso(req.params.id);
  if (!c) return res.status(404).json({ error: "Congreso no encontrado" });
  const { roster, ...config } = c; // el roster nunca se expone completo al público
  res.json(config);
});

app.get("/api/congresos/:id/roster/validar", (req, res) => {
  const c = loadCongreso(req.params.id);
  if (!c) return res.status(404).json({ error: "Congreso no encontrado" });
  const dni = String(req.query.dni || "").trim();
  if (!dni) return res.status(400).json({ error: "Falta el DNI" });
  const persona = (c.roster || []).find((p) => String(p.dni).trim() === dni);
  if (!persona) return res.json({ found: false });
  res.json({
    found: true,
    nombre: persona.nombre,
    categoria: persona.categoria,
    habilitado: !!persona.habilitado,
  });
});

/* ============================================================
   API ADMIN (requiere token) — branding, herramientas, notificaciones, info
   ============================================================ */
app.get("/api/admin/congresos/:id", auth, (req, res) => {
  const c = loadCongreso(req.params.id);
  if (!c) return res.status(404).json({ error: "Congreso no encontrado" });
  res.json(c); // acá sí incluye el roster, para mostrarlo en el panel
});

app.post("/api/admin/congresos/:id", auth, (req, res) => {
  // crea el congreso si no existe (alta de un evento nuevo)
  const existing = loadCongreso(req.params.id) || { id: req.params.id, roster: [] };
  const updated = { ...existing, ...req.body, id: req.params.id };
  saveCongreso(req.params.id, updated);
  res.json({ ok: true });
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.post("/api/admin/congresos/:id/roster", auth, upload.single("archivo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const roster = rows
      .map((r) => ({
        dni: String(r.DNI ?? r.dni ?? r.Dni ?? "").trim(),
        nombre: String(r.Nombre ?? r.nombre ?? "").trim(),
        categoria: String(r.Categoria ?? r.categoria ?? r["Categoría"] ?? "").trim(),
        habilitado: /^(si|sí|true|1|x)$/i.test(String(r.Habilitado ?? r.habilitado ?? "").trim()),
      }))
      .filter((p) => p.dni);

    if (!roster.length) {
      return res.status(400).json({ error: "No se encontraron filas válidas. Verificá que el Excel tenga columnas DNI, Nombre, Categoria, Habilitado." });
    }

    const c = loadCongreso(req.params.id) || { id: req.params.id };
    c.roster = roster;
    saveCongreso(req.params.id, c);
    res.json({ ok: true, count: roster.length });
  } catch (e) {
    res.status(400).json({ error: "No se pudo procesar el Excel: " + e.message });
  }
});

app.listen(PORT, () => {
  console.log(`G2 Congresos backend escuchando en http://localhost:${PORT}`);
  console.log(`Panel admin en http://localhost:${PORT}/admin  (clave: ${ADMIN_PASSWORD})`);
});
