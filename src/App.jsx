import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LayoutDashboard, Package, Warehouse as WarehouseIcon, MapPin, Grid3x3,
  Plus, Pencil, Trash2, Search, X, ChevronDown, ChevronRight, ChevronLeft,
  Loader2, CheckCircle2, XCircle, Boxes, Layers, PackageSearch, AlertTriangle,
  Menu, History, ShoppingCart, TrendingDown, Lock, Eye, EyeOff
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot,
  getDocs, writeBatch, query,
} from "firebase/firestore";
import { firebaseConfig, SHARED_PASSWORD } from "./firebaseConfig.js";

/* ---------------------------------------------------------------------
   Stockroom — Warehouse Management System
   Data persists to Firebase Firestore in real time, shared across every
   device/user that has the shared password — everyone sees the same
   live inventory. See firebaseConfig.js for setup.
--------------------------------------------------------------------- */

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&family=Fira+Code:wght@400;500;600&display=swap');`;

const COLORS = {
  navy950: "#0A1826",
  navy900: "#0F2942",
  navy800: "#163654",
  navy700: "#1E4560",
  steel600: "#2C5F82",
  steel400: "#5C8AAB",
  accent500: "#E8871E",
  accent600: "#C96F12",
  accent100: "#FCEAD2",
  canvas: "#F3F5F7",
  card: "#FFFFFF",
  border: "#DCE3E8",
  text900: "#16232E",
  text600: "#52697A",
  text400: "#8598A6",
  success: "#2E7D5B",
  successBg: "#E4F4EC",
  danger: "#C0392B",
  dangerBg: "#FBEAE8",
};

/* ----------------------------- Firebase ----------------------------- */

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const COLLECTIONS = {
  warehouses: "warehouses",
  shelves: "shelves",
  products: "products",
  locations: "product_locations",
  sales: "sales",
  meta: "meta",
};

const AUTH_SESSION_KEY = "stockroom_unlocked";
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Live-subscribe to a Firestore collection; keeps state in sync across every connected user. */
function subscribeCollection(name, onChange, onError) {
  return onSnapshot(collection(db, name), (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onChange(rows);
  }, (err) => {
    console.error(`Firestore subscription error (${name}):`, err);
    if (onError) onError(err, name);
  });
}

async function setDocById(collectionName, id, data) {
  await setDoc(doc(db, collectionName, id), data);
}

async function deleteDocById(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id));
}

async function collectionIsEmpty(name) {
  const snap = await getDocs(query(collection(db, name)));
  return snap.empty;
}

function seedData() {
  const w1 = uid("wh"), w2 = uid("wh"), w3 = uid("wh");
  const warehouses = [
    { id: w1, name: "Main Warehouse", address: "Lichtenbergstr. 25, Darmstadt", description: "Primary storage facility" },
    { id: w2, name: "Overflow Warehouse", address: "Industriestr. 12, Darmstadt", description: "Secondary overflow stock" },
    { id: w3, name: "Cold Storage Annex", address: "Pfnorrstr. 8, Darmstadt", description: "Climate-controlled storage" },
  ];

  const s = {
    a1: uid("sh"), a2: uid("sh"), a3: uid("sh"),
    b1: uid("sh"), b2: uid("sh"), b3: uid("sh"),
    c1: uid("sh"), c2: uid("sh"), c3: uid("sh"),
  };
  const shelves = [
    { id: s.a1, warehouseId: w1, name: "Shelf A1", totalColumns: 4, totalParts: 5 },
    { id: s.a2, warehouseId: w1, name: "Shelf A2", totalColumns: 3, totalParts: 4 },
    { id: s.a3, warehouseId: w1, name: "Shelf A3", totalColumns: 5, totalParts: 3 },
    { id: s.b1, warehouseId: w2, name: "Shelf B1", totalColumns: 4, totalParts: 4 },
    { id: s.b2, warehouseId: w2, name: "Shelf B2", totalColumns: 3, totalParts: 5 },
    { id: s.b3, warehouseId: w2, name: "Shelf B3", totalColumns: 2, totalParts: 6 },
    { id: s.c1, warehouseId: w3, name: "Shelf C1", totalColumns: 3, totalParts: 3 },
    { id: s.c2, warehouseId: w3, name: "Shelf C2", totalColumns: 4, totalParts: 4 },
    { id: s.c3, warehouseId: w3, name: "Shelf C3", totalColumns: 2, totalParts: 4 },
  ];

  const p = {};
  const productDefs = [
    ["Hex Bolts M8", "REF-1001", "Fasteners", "Würth", 0.15, 480, "Zinc-plated M8 hex bolts, 40mm length."],
    ["Steel Washers 10mm", "REF-1002", "Fasteners", "Würth", 0.05, 1200, "Flat steel washers, 10mm bore."],
    ["Cordless Drill Set", "REF-1003", "Power Tools", "Bosch", 89.99, 12, "18V cordless drill with two batteries."],
    ["Safety Gloves L", "REF-1004", "Safety Equipment", "Uvex", 4.50, 200, "Cut-resistant work gloves, size L."],
    ["PVC Pipe 2m", "REF-1005", "Plumbing", "Geberit", 6.20, 60, "Rigid PVC pipe, 2m length, 40mm diameter."],
    ["LED Work Light", "REF-1006", "Electrical", "Osram", 22.00, 35, "Rechargeable LED work light, 1500 lumens."],
    ["Paint Roller Set", "REF-1007", "Painting", "Storch", 8.75, 90, "9-inch roller set with tray."],
    ["Extension Cord 10m", "REF-1008", "Electrical", "Brennenstuhl", 15.30, 40, "Outdoor-rated extension cord, 3-socket."],
    ["Wood Screws 4x40", "REF-1009", "Fasteners", "Würth", 0.03, 3000, "Countersunk wood screws, 4x40mm."],
    ["Safety Goggles", "REF-1010", "Safety Equipment", "Uvex", 3.10, 150, "Anti-fog polycarbonate safety goggles."],
  ];
  const lowStockDefs = { "REF-1001": 100, "REF-1003": 15, "REF-1004": 50, "REF-1006": 40 };
  const products = productDefs.map((d) => {
    const id = uid("pr");
    p[d[1]] = id;
    return {
      id, name: d[0], oem_reference: `OEM-${d[1].slice(4)}`,
      references: [{ code: d[1], brand: "" }], category: d[2], piece_product_name: d[3],
      price_per_piece: d[4], total_quantity: d[5], description: d[6], image_url: "",
      low_stock_threshold: lowStockDefs[d[1]] ?? DEFAULT_LOW_STOCK_THRESHOLD,
    };
  });

  const locations = [
    { id: uid("loc"), productId: p["REF-1001"], warehouseId: w1, shelfId: s.a1, column: 1, part: 1, quantity: 200 },
    { id: uid("loc"), productId: p["REF-1001"], warehouseId: w1, shelfId: s.a1, column: 1, part: 2, quantity: 280 },
    { id: uid("loc"), productId: p["REF-1002"], warehouseId: w1, shelfId: s.a1, column: 2, part: 1, quantity: 1200 },
    { id: uid("loc"), productId: p["REF-1003"], warehouseId: w1, shelfId: s.a2, column: 1, part: 1, quantity: 12 },
    { id: uid("loc"), productId: p["REF-1004"], warehouseId: w1, shelfId: s.a2, column: 2, part: 1, quantity: 200 },
    { id: uid("loc"), productId: p["REF-1005"], warehouseId: w2, shelfId: s.b1, column: 1, part: 1, quantity: 60 },
    { id: uid("loc"), productId: p["REF-1006"], warehouseId: w2, shelfId: s.b1, column: 2, part: 1, quantity: 35 },
    { id: uid("loc"), productId: p["REF-1007"], warehouseId: w2, shelfId: s.b2, column: 1, part: 1, quantity: 90 },
    { id: uid("loc"), productId: p["REF-1008"], warehouseId: w2, shelfId: s.b2, column: 1, part: 2, quantity: 40 },
    { id: uid("loc"), productId: p["REF-1009"], warehouseId: w2, shelfId: s.b3, column: 1, part: 1, quantity: 1500 },
    { id: uid("loc"), productId: p["REF-1009"], warehouseId: w2, shelfId: s.b3, column: 1, part: 2, quantity: 1500 },
    { id: uid("loc"), productId: p["REF-1010"], warehouseId: w3, shelfId: s.c1, column: 1, part: 1, quantity: 150 },
    { id: uid("loc"), productId: p["REF-1002"], warehouseId: w3, shelfId: s.c2, column: 1, part: 1, quantity: 0 },
    { id: uid("loc"), productId: p["REF-1006"], warehouseId: w3, shelfId: s.c2, column: 2, part: 1, quantity: 0 },
    { id: uid("loc"), productId: p["REF-1003"], warehouseId: w3, shelfId: s.c3, column: 1, part: 1, quantity: 0 },
    { id: uid("loc"), productId: p["REF-1007"], warehouseId: w3, shelfId: s.c3, column: 2, part: 1, quantity: 0 },
  ].map((l) => ({ ...l, quantity: l.quantity }));

  // fix duplicate/zero quantity leftovers from copy above (keep realistic non-zero seed values)
  locations[12].quantity = 0;
  locations[13].quantity = 0;
  locations[14].quantity = 0;
  locations[15].quantity = 0;
  const realQuantities = [200, 280, 1200, 12, 200, 60, 35, 90, 40, 1500, 1500, 150, 300, 20, 8, 30];
  locations.forEach((l, i) => (l.quantity = realQuantities[i]));

  // Demo a product with multiple references (e.g. an old and current supplier code)
  const drill = products.find((pr) => pr.name === "Cordless Drill Set");
  if (drill) drill.references = [{ code: "REF-1003", brand: "Bosch" }, { code: "SUP-DR18-OLD", brand: "Generic" }];

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const sales = [
    { id: uid("sale"), productId: p["REF-1001"], quantity: 60, date: daysAgo(2), note: "" },
    { id: uid("sale"), productId: p["REF-1001"], quantity: 40, date: daysAgo(9), note: "" },
    { id: uid("sale"), productId: p["REF-1003"], quantity: 3, date: daysAgo(1), note: "" },
    { id: uid("sale"), productId: p["REF-1003"], quantity: 2, date: daysAgo(14), note: "" },
    { id: uid("sale"), productId: p["REF-1006"], quantity: 5, date: daysAgo(4), note: "" },
    { id: uid("sale"), productId: p["REF-1009"], quantity: 500, date: daysAgo(6), note: "" },
  ];

  return { warehouses, shelves, products, locations, sales };
}

/* ----------------------------- Toasts ----------------------------- */

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((type, message) => {
    const id = uid("toast");
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  return { toasts, push, dismiss };
}

function ToastStack({ toasts, dismiss }) {
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 200, display: "flex", flexDirection: "column", gap: 8, width: 320 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderLeft: `4px solid ${t.type === "error" ? COLORS.danger : COLORS.success}`,
            borderRadius: 8, padding: "10px 12px", boxShadow: "0 6px 20px rgba(15,41,66,0.12)",
            animation: "stockroom-slide-in 0.18s ease-out",
          }}
        >
          {t.type === "error" ? (
            <XCircle size={17} color={COLORS.danger} style={{ marginTop: 1, flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={17} color={COLORS.success} style={{ marginTop: 1, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 13.5, color: COLORS.text900, lineHeight: 1.4, flex: 1 }}>{t.message}</span>
          <button onClick={() => dismiss(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.text400, padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Small UI atoms ----------------------------- */

function Badge({ children, tone = "steel" }) {
  const tones = {
    steel: { bg: "#EAF1F6", fg: COLORS.steel600 },
    amber: { bg: COLORS.accent100, fg: COLORS.accent600 },
    success: { bg: COLORS.successBg, fg: COLORS.success },
    gray: { bg: "#EEF1F3", fg: COLORS.text600 },
  };
  const c = tones[tone] || tones.steel;
  return (
    <span style={{
      display: "inline-block", background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 600,
      padding: "2px 8px", borderRadius: 5, letterSpacing: 0.2, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function Mono({ children, style }) {
  return <span style={{ fontFamily: "'Fira Code', monospace", fontSize: "0.92em", ...style }}>{children}</span>;
}

function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10,
      padding: "18px 20px", display: "flex", alignItems: "center", gap: 14,
      transition: "box-shadow 0.15s ease", flex: "1 1 200px", minWidth: 200,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 9, background: COLORS.navy900,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={20} color={COLORS.accent500} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: COLORS.text600, fontWeight: 500, marginBottom: 3 }}>{label}</div>
        {loading ? (
          <div style={{ width: 48, height: 20, background: "#EEF1F3", borderRadius: 4 }} className="stockroom-skel" />
        ) : (
          <div style={{ fontSize: 23, fontWeight: 700, color: COLORS.text900, fontFamily: "'Fira Code', monospace" }}>{value}</div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle, ctaLabel, onCta }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "56px 20px", textAlign: "center", color: COLORS.text600,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 12, background: "#EEF1F3",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
      }}>
        <Icon size={24} color={COLORS.text400} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text900, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, marginBottom: ctaLabel ? 16 : 0, maxWidth: 340 }}>{subtitle}</div>
      {ctaLabel && (
        <button onClick={onCta} style={btnPrimary()}>
          <Plus size={15} /> {ctaLabel}
        </button>
      )}
    </div>
  );
}

function SkeletonRows({ rows = 4, cols = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} style={{ padding: "12px 16px" }}>
              <div className="stockroom-skel" style={{ height: 14, borderRadius: 4, background: "#EEF1F3", width: c === 0 ? "70%" : "50%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function btnPrimary(extra) {
  return {
    display: "inline-flex", alignItems: "center", gap: 6, background: COLORS.accent500, color: "#fff",
    border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
    transition: "background 0.15s ease", fontFamily: "inherit", ...extra,
  };
}
function btnSecondary(extra) {
  return {
    display: "inline-flex", alignItems: "center", gap: 6, background: COLORS.card, color: COLORS.text900,
    border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "8px 14px", fontSize: 13.5, fontWeight: 600,
    cursor: "pointer", transition: "background 0.15s ease", fontFamily: "inherit", ...extra,
  };
}
function iconBtn(extra) {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30,
    background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: "pointer",
    color: COLORS.text600, transition: "all 0.15s ease", ...extra,
  };
}

function TextField({ label, required, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: COLORS.text900, marginBottom: 5 }}>
        {label} {required && <span style={{ color: COLORS.accent600 }}>*</span>}
      </span>
      <input
        {...props}
        style={{
          width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 7,
          padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: COLORS.text900, outline: "none",
          transition: "border-color 0.15s ease",
        }}
        onFocus={(e) => { e.target.style.borderColor = COLORS.steel600; props.onFocus?.(e); }}
        onBlur={(e) => { e.target.style.borderColor = COLORS.border; props.onBlur?.(e); }}
      />
    </label>
  );
}

function TextAreaField({ label, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: COLORS.text900, marginBottom: 5 }}>{label}</span>
      <textarea
        {...props}
        rows={props.rows || 3}
        style={{
          width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 7,
          padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: COLORS.text900, outline: "none", resize: "vertical",
        }}
        onFocus={(e) => { e.target.style.borderColor = COLORS.steel600; }}
        onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
      />
    </label>
  );
}

function SelectField({ label, required, children, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: COLORS.text900, marginBottom: 5 }}>
        {label} {required && <span style={{ color: COLORS.accent600 }}>*</span>}
      </span>
      <select
        {...props}
        style={{
          width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 7,
          padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: COLORS.text900, outline: "none", background: "#fff",
        }}
      >
        {children}
      </select>
    </label>
  );
}

function Modal({ title, onClose, children, width = 460 }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(10,24,38,0.45)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: COLORS.card, borderRadius: 12, width, maxWidth: "100%", maxHeight: "88vh",
        overflowY: "auto", boxShadow: "0 20px 60px rgba(10,24,38,0.25)", animation: "stockroom-pop-in 0.15s ease-out",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, background: COLORS.card, borderRadius: "12px 12px 0 0",
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.text900 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.text400, padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel} width={380}>
      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <AlertTriangle size={20} color={COLORS.danger} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 13.5, color: COLORS.text600, lineHeight: 1.5 }}>{message}</p>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button style={btnSecondary()} onClick={onCancel}>Cancel</button>
        <button style={btnPrimary({ background: COLORS.danger })} onClick={onConfirm}>Delete</button>
      </div>
    </Modal>
  );
}

/* ----------------------------- App Layout ----------------------------- */

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "products", label: "Products", icon: Package },
  { key: "warehouses", label: "Warehouses", icon: WarehouseIcon },
  { key: "locations", label: "Product Locations", icon: MapPin },
  { key: "browse", label: "Location Browser", icon: Grid3x3 },
];

function Sidebar({ page, setPage, collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  return (
    <>
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      )}
      <div style={{
        width: collapsed ? 68 : 226, flexShrink: 0, background: COLORS.navy950, display: "flex",
        flexDirection: "column", transition: "width 0.18s ease", height: "100%",
        position: mobileOpen ? "fixed" : "relative", zIndex: 50, left: mobileOpen ? 0 : undefined, top: 0,
      }}
      className={mobileOpen ? "stockroom-sidebar-mobile" : ""}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "18px 16px", borderBottom: `1px solid ${COLORS.navy800}`,
          minHeight: 56,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7, background: COLORS.accent500, display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Boxes size={17} color={COLORS.navy950} />
          </div>
          {!collapsed && <span style={{ color: "#fff", fontWeight: 700, fontSize: 15.5, letterSpacing: 0.2 }}>Stockroom</span>}
        </div>

        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV.map((n) => {
            const active = page === n.key;
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                onClick={() => { setPage(n.key); setMobileOpen(false); }}
                title={collapsed ? n.label : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 7,
                  background: active ? COLORS.navy800 : "transparent", border: "none", cursor: "pointer",
                  color: active ? "#fff" : "#9FB3C4", fontSize: 13.5, fontWeight: 500, textAlign: "left",
                  borderLeft: active ? `3px solid ${COLORS.accent500}` : "3px solid transparent",
                  transition: "all 0.15s ease", fontFamily: "inherit",
                }}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{n.label}</span>}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-end",
            padding: "12px 16px", background: "transparent", border: "none", borderTop: `1px solid ${COLORS.navy800}`,
            color: "#9FB3C4", cursor: "pointer",
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </>
  );
}

/* ----------------------------- Dashboard ----------------------------- */

function Dashboard({ data, loading, setPage }) {
  const { warehouses, shelves, products, locations } = data;
  const totalSlots = useMemo(() => shelves.reduce((sum, s) => sum + s.totalColumns * s.totalParts, 0), [shelves]);
  const totalItems = useMemo(() => locations.reduce((sum, l) => sum + Number(l.quantity || 0), 0), [locations]);
  const recent = useMemo(() => [...products].slice(-6).reverse(), [products]);
  const lowStock = useMemo(
    () => products
      .filter((p) => Number(p.total_quantity || 0) <= Number(p.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD))
      .sort((a, b) => Number(a.total_quantity || 0) - Number(b.total_quantity || 0)),
    [products]
  );

  const warehouseById = useMemo(() => Object.fromEntries(warehouses.map((w) => [w.id, w])), [warehouses]);
  const shelfById = useMemo(() => Object.fromEntries(shelves.map((s) => [s.id, s])), [shelves]);
  const locationsByProduct = useMemo(() => {
    const map = {};
    locations.forEach((l) => {
      if (!map[l.productId]) map[l.productId] = [];
      map[l.productId].push(l);
    });
    return map;
  }, [locations]);

  const describeLocations = (productId) => {
    const locs = locationsByProduct[productId] || [];
    if (locs.length === 0) return "No location assigned";
    const first = locs[0];
    const w = warehouseById[first.warehouseId];
    const s = shelfById[first.shelfId];
    const text = `${w?.name || "Unknown warehouse"} / ${s?.name || "Unknown shelf"} (Col ${first.column}, Part ${first.part})`;
    return locs.length > 1 ? `${text} +${locs.length - 1} more` : text;
  };

  const describeReference = (p) => {
    if (p.oem_reference) return p.oem_reference;
    if (p.references && p.references.length) return p.references[0].code;
    return "No reference";
  };

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your stock across all warehouses." />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 26 }}>
        <StatCard icon={Package} label="Total Products" value={products.length} loading={loading} />
        <StatCard icon={WarehouseIcon} label="Warehouses" value={warehouses.length} loading={loading} />
        <StatCard icon={Grid3x3} label="Storage Locations" value={totalSlots} loading={loading} />
        <StatCard icon={Boxes} label="Total Items in Stock" value={totalItems.toLocaleString()} loading={loading} />
      </div>

      {!loading && lowStock.length > 0 && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.danger}33`, borderRadius: 10, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 9, background: COLORS.dangerBg }}>
            <AlertTriangle size={16} color={COLORS.danger} />
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: COLORS.text900 }}>Low stock alert</h3>
            <span style={{ marginLeft: "auto" }}><Badge tone="gray">{lowStock.length} product{lowStock.length === 1 ? "" : "s"}</Badge></span>
          </div>
          <div>
            {lowStock.slice(0, 8).map((p) => (
              <div key={p.id} onClick={() => setPage("products")} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px",
                borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer", gap: 12,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.text900 }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: COLORS.text400, display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                    <Mono style={{ color: COLORS.text600 }}>{describeReference(p)}</Mono>
                    <span>·</span>
                    <span>{describeLocations(p.id)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: COLORS.text400, marginTop: 2 }}>Alert threshold: {Number(p.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <TrendingDown size={14} color={COLORS.danger} />
                  <Mono style={{ color: COLORS.danger, fontWeight: 700, fontSize: 13.5 }}>{Number(p.total_quantity || 0).toLocaleString()}</Mono>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: COLORS.text900 }}>Recent products</h3>
          <button onClick={() => setPage("products")} style={{ ...btnSecondary(), padding: "6px 11px", fontSize: 12.5 }}>View all</button>
        </div>
        {loading ? (
          <div style={{ padding: 18 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stockroom-skel" style={{ height: 40, borderRadius: 6, background: "#EEF1F3", marginBottom: 8 }} />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No products yet" subtitle="Add your first product to see it appear here." ctaLabel="Add product" onCta={() => setPage("products")} />
        ) : (
          <div>
            {recent.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: `1px solid ${COLORS.border}` }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.text900 }}>{p.name}</div>
                  <Mono style={{ color: COLORS.text400, fontSize: 12 }}>{(p.references || []).map((r) => r.code).join(", ") || "—"}</Mono>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Badge tone="amber">{p.piece_product_name || "—"}</Badge>
                  <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 13, color: COLORS.text900, minWidth: 44, textAlign: "right" }}>
                    {Number(p.total_quantity || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: COLORS.text900 }}>{title}</h1>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.text600 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative", minWidth: 220, flex: "1 1 220px" }}>
      <Search size={15} color={COLORS.text400} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 7,
          padding: "8px 11px 8px 33px", fontSize: 13.5, fontFamily: "inherit", outline: "none", color: COLORS.text900,
        }}
      />
    </div>
  );
}

/* ----------------------------- Products page ----------------------------- */

function ReferencesField({ references, onChange }) {
  const list = references && references.length ? references : [{ code: "", brand: "" }];
  const update = (i, key, value) => {
    const next = list.map((r, idx) => (idx === i ? { ...r, [key]: value } : r));
    onChange(next);
  };
  const add = () => onChange([...list, { code: "", brand: "" }]);
  const remove = (i) => onChange(list.length === 1 ? [{ code: "", brand: "" }] : list.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginBottom: 14, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12, background: "#FAFBFC" }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: COLORS.text900, marginBottom: 8 }}>Other references</span>
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <span style={{ flex: 1, fontSize: 11, color: COLORS.text400, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Reference code</span>
        <span style={{ flex: 1, fontSize: 11, color: COLORS.text400, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Brand for this reference</span>
        <span style={{ width: 30, flexShrink: 0 }} />
      </div>
      {list.map((ref, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            value={ref.code}
            onChange={(e) => update(i, "code", e.target.value)}
            placeholder={i === 0 ? "e.g. CT986" : "Additional reference / alt SKU"}
            style={{
              flex: 1, boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 7,
              padding: "9px 11px", fontSize: 13.5, fontFamily: "'Fira Code', monospace", color: COLORS.text900, outline: "none",
              background: "#fff",
            }}
            onFocus={(e) => { e.target.style.borderColor = COLORS.steel600; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
          <input
            value={ref.brand}
            onChange={(e) => update(i, "brand", e.target.value)}
            placeholder="e.g. Gates"
            style={{
              flex: 1, boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 7,
              padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: COLORS.text900, outline: "none",
              background: "#fff",
            }}
            onFocus={(e) => { e.target.style.borderColor = COLORS.steel600; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
          {list.length > 1 && (
            <button type="button" onClick={() => remove(i)} style={iconBtn({ color: COLORS.danger, flexShrink: 0, background: "#fff" })}>
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={add} style={{ ...btnSecondary({ padding: "5px 10px", fontSize: 12 }), marginTop: 2 }}>
        <Plus size={12} /> Add another reference
      </button>
      <div style={{ fontSize: 11.5, color: COLORS.text400, marginTop: 8 }}>
        Use this when the same product is listed under different supplier codes — each can have its own brand (e.g. CT986 by Gates, 5282XS by Dayco).
      </div>
    </div>
  );
}

function ProductModal({ initial, data, onClose, onSave }) {
  const { warehouses, shelves } = data;
  const [form, setForm] = useState(initial || {
    name: "", oem_reference: "", references: [{ code: "", brand: "" }], category: "", piece_product_name: "", total_quantity: 0,
    low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
  });
  const [assignLocation, setAssignLocation] = useState(false);
  const [loc, setLoc] = useState({
    warehouseId: warehouses[0]?.id || "", shelfId: "", column: 1, part: 1,
  });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const shelfOptions = shelves.filter((s) => s.warehouseId === loc.warehouseId);
  const selectedShelf = shelves.find((s) => s.id === loc.shelfId);

  useEffect(() => {
    if (!shelfOptions.find((s) => s.id === loc.shelfId)) {
      setLoc((f) => ({ ...f, shelfId: shelfOptions[0]?.id || "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.warehouseId]);

  const submit = () => {
    if (!form.name.trim()) { setError("Product name is required."); return; }
    const references = (form.references || [])
      .map((r) => ({ code: (r.code || "").trim(), brand: (r.brand || "").trim() }))
      .filter((r) => r.code);
    let location = null;
    if (assignLocation && !initial) {
      if (!loc.warehouseId) { setError("Choose a warehouse for the location."); return; }
      if (!loc.shelfId) { setError("Choose a shelf for the location."); return; }
      if (selectedShelf && (Number(loc.column) > selectedShelf.totalColumns || Number(loc.part) > selectedShelf.totalParts)) {
        setError(`This shelf only has ${selectedShelf.totalColumns} columns and ${selectedShelf.totalParts} parts.`);
        return;
      }
      location = { warehouseId: loc.warehouseId, shelfId: loc.shelfId, column: Number(loc.column), part: Number(loc.part), quantity: Number(form.total_quantity) || 0 };
    }
    onSave({
      ...form,
      references,
      total_quantity: Number(form.total_quantity) || 0,
      low_stock_threshold: form.low_stock_threshold === "" || form.low_stock_threshold == null
        ? DEFAULT_LOW_STOCK_THRESHOLD : Number(form.low_stock_threshold),
    }, location);
  };

  return (
    <Modal title={initial ? "Edit product" : "Add product"} onClose={onClose}>
      <TextField label="Product name" required value={form.name} onChange={set("name")} placeholder="e.g. Hex Bolts M8" />
      <TextField label="Reference" value={form.oem_reference} onChange={set("oem_reference")} placeholder="e.g. REF-1001" />
      <ReferencesField
        references={form.references}
        onChange={(references) => setForm((f) => ({ ...f, references }))}
      />
      <TextField label="Category" value={form.category} onChange={set("category")} placeholder="e.g. Fasteners" />
      <TextField label="Brand" value={form.piece_product_name} onChange={set("piece_product_name")} placeholder="e.g. Contitech (main brand for this product)" />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><TextField label="Total quantity" type="number" value={form.total_quantity} onChange={set("total_quantity")} /></div>
        <div style={{ flex: 1 }}><TextField label="Low stock alert below" type="number" value={form.low_stock_threshold} onChange={set("low_stock_threshold")} placeholder="10" /></div>
      </div>

      {!initial && (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 4, paddingTop: 14, marginBottom: 4 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: assignLocation ? 12 : 0 }}>
            <input type="checkbox" checked={assignLocation} onChange={(e) => setAssignLocation(e.target.checked)} style={{ width: 15, height: 15 }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.text900 }}>Assign a storage location now</span>
          </label>
          {assignLocation && (
            warehouses.length === 0 ? (
              <div style={{ fontSize: 12.5, color: COLORS.text400 }}>No warehouses yet — add one first from the Warehouses page.</div>
            ) : (
              <>
                <SelectField label="Warehouse" required value={loc.warehouseId} onChange={(e) => setLoc((f) => ({ ...f, warehouseId: e.target.value }))}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </SelectField>
                <SelectField label="Shelf" required value={loc.shelfId} onChange={(e) => setLoc((f) => ({ ...f, shelfId: e.target.value }))}>
                  {shelfOptions.length === 0 && <option value="">No shelves in this warehouse</option>}
                  {shelfOptions.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.totalColumns}×{s.totalParts})</option>)}
                </SelectField>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <TextField label="Column" type="number" min={1} max={selectedShelf?.totalColumns || 99}
                      value={loc.column} onChange={(e) => setLoc((f) => ({ ...f, column: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField label="Part" type="number" min={1} max={selectedShelf?.totalParts || 99}
                      value={loc.part} onChange={(e) => setLoc((f) => ({ ...f, part: e.target.value }))} />
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: COLORS.text400, marginTop: -6 }}>The product's total quantity will be placed in this slot.</div>
              </>
            )
          )}
        </div>
      )}

      {error && <div style={{ color: COLORS.danger, fontSize: 12.5, marginTop: 12, marginBottom: 4 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button style={btnSecondary()} onClick={onClose}>Cancel</button>
        <button style={btnPrimary()} onClick={submit}>{initial ? "Save changes" : "Add product"}</button>
      </div>
    </Modal>
  );
}

function RecordSaleModal({ product, onClose, onSave }) {
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const qty = Number(quantity);
    if (!quantity || qty <= 0) { setError("Enter a quantity greater than 0."); return; }
    if (qty > Number(product.total_quantity || 0)) { setError(`Only ${product.total_quantity} in stock.`); return; }
    onSave({ quantity: qty, date, note });
  };

  return (
    <Modal title={`Record sale — ${product.name}`} onClose={onClose} width={400}>
      <div style={{ fontSize: 12.5, color: COLORS.text600, marginBottom: 14 }}>
        Currently in stock: <Mono style={{ color: COLORS.text900, fontWeight: 600 }}>{Number(product.total_quantity || 0).toLocaleString()}</Mono>
      </div>
      <TextField label="Quantity sold" required type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 10" />
      <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      {error && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <button style={btnSecondary()} onClick={onClose}>Cancel</button>
        <button style={btnPrimary()} onClick={submit}>Record sale</button>
      </div>
    </Modal>
  );
}

function SalesHistoryModal({ product, sales, onClose }) {
  const list = useMemo(
    () => sales.filter((s) => s.productId === product.id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [sales, product.id]
  );
  const total = list.reduce((sum, s) => sum + Number(s.quantity || 0), 0);

  return (
    <Modal title={`Sales history — ${product.name}`} onClose={onClose} width={440}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: COLORS.text600 }}>Total units sold</span>
        <Mono style={{ fontWeight: 700, fontSize: 15, color: COLORS.text900 }}>{total.toLocaleString()}</Mono>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={History} title="No sales recorded" subtitle="Record a sale to start building history for this product." />
      ) : (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
          {list.map((s, i) => (
            <div key={s.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px",
              borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}`,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text900 }}>{s.date}</div>
                {s.note && <div style={{ fontSize: 11.5, color: COLORS.text400 }}>{s.note}</div>}
              </div>
              <Mono style={{ fontSize: 13, color: COLORS.text900 }}>-{Number(s.quantity || 0).toLocaleString()}</Mono>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button style={btnSecondary()} onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function ProductsPage({ data, mutate, toast }) {
  const { products, sales } = data;
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', product }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saleModal, setSaleModal] = useState(null); // product
  const [historyModal, setHistoryModal] = useState(null); // product

  const soldByProduct = useMemo(() => {
    const map = {};
    (sales || []).forEach((s) => { map[s.productId] = (map[s.productId] || 0) + Number(s.quantity || 0); });
    return map;
  }, [sales]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.oem_reference || "").toLowerCase().includes(q) ||
      (p.references || []).some((r) => r.code.toLowerCase().includes(q) || (r.brand || "").toLowerCase().includes(q)) ||
      (p.category || "").toLowerCase().includes(q)
    );
  }, [products, query]);

  const handleSave = async (form, location) => {
    if (modal?.product) {
      await mutate.updateProduct(modal.product.id, form);
      toast.push("success", `${form.name} updated.`);
    } else {
      const newProduct = await mutate.addProduct(form);
      if (location) {
        await mutate.addLocation({ productId: newProduct.id, ...location });
        toast.push("success", `${form.name} added and placed in storage.`);
      } else {
        toast.push("success", `${form.name} added.`);
      }
    }
    setModal(null);
  };

  const handleDelete = async () => {
    await mutate.deleteProduct(confirmDelete.id);
    toast.push("success", `${confirmDelete.name} deleted.`);
    setConfirmDelete(null);
  };

  const handleRecordSale = async (form) => {
    await mutate.addSale(saleModal.id, form);
    toast.push("success", `Sale of ${form.quantity} recorded for ${saleModal.name}.`);
    setSaleModal(null);
  };

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Every item you stock, independent of where it's stored."
        action={<button style={btnPrimary()} onClick={() => setModal({ mode: "add" })}><Plus size={15} /> Add product</button>}
      />
      <div style={{ marginBottom: 14 }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name, reference, or category" />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 900 }}>
          <thead>
            <tr style={{ background: "#F8FAFB", textAlign: "left" }}>
              {["Product", "Reference", "Other References", "Category", "Brand", "Quantity", "Sales history", ""].map((h) => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 11.5, fontWeight: 700, color: COLORS.text600, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.loading ? (
              <SkeletonRows rows={5} cols={8} />
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8}>
                <EmptyState
                  icon={PackageSearch}
                  title={query ? "No matching products" : "No products yet"}
                  subtitle={query ? "Try a different search term." : "Add your first product to start tracking inventory."}
                  ctaLabel={query ? undefined : "Add product"}
                  onCta={() => setModal({ mode: "add" })}
                />
              </td></tr>
            ) : filtered.map((p) => {
              const refs = p.references && p.references.length ? p.references : [];
              const low = Number(p.total_quantity || 0) <= Number(p.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD);
              const sold = soldByProduct[p.id] || 0;
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: COLORS.text900 }}>{p.name}</td>
                  <td style={{ padding: "12px 16px" }}>{p.oem_reference ? <Mono style={{ color: COLORS.text600 }}>{p.oem_reference}</Mono> : <span style={{ color: COLORS.text400 }}>—</span>}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {refs.length === 0 ? <span style={{ color: COLORS.text400 }}>—</span> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {refs.map((r, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Mono style={{ color: COLORS.text600, background: "#F1F4F6", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>{r.code}</Mono>
                            {r.brand && <span style={{ fontSize: 11, color: COLORS.text400 }}>{r.brand}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: COLORS.text600 }}>{p.category || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>{p.piece_product_name ? <Badge tone="amber">{p.piece_product_name}</Badge> : <span style={{ color: COLORS.text400 }}>—</span>}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Mono>{Number(p.total_quantity || 0).toLocaleString()}</Mono>
                      {low && <span title="Low stock"><AlertTriangle size={13} color={COLORS.danger} /></span>}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => setHistoryModal(p)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 5 }}
                    >
                      <History size={13} color={COLORS.steel600} />
                      <Mono style={{ color: COLORS.steel600, fontSize: 12.5 }}>{sold.toLocaleString()} sold</Mono>
                    </button>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button style={iconBtn()} title="Record sale" onClick={() => setSaleModal(p)}><ShoppingCart size={14} /></button>
                      <button style={iconBtn()} title="Edit" onClick={() => setModal({ mode: "edit", product: p })}><Pencil size={14} /></button>
                      <button style={iconBtn({ color: COLORS.danger })} title="Delete" onClick={() => setConfirmDelete(p)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && <ProductModal initial={modal.product} data={data} onClose={() => setModal(null)} onSave={handleSave} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete product"
          message={`Delete "${confirmDelete.name}"? This also removes its assigned storage locations. This can't be undone.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
      {saleModal && <RecordSaleModal product={saleModal} onClose={() => setSaleModal(null)} onSave={handleRecordSale} />}
      {historyModal && <SalesHistoryModal product={historyModal} sales={sales} onClose={() => setHistoryModal(null)} />}
    </div>
  );
}

/* ----------------------------- Warehouses page ----------------------------- */

function WarehouseModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { name: "", address: "", description: "" });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title={initial ? "Edit warehouse" : "Add warehouse"} onClose={onClose}>
      <TextField label="Name" required value={form.name} onChange={set("name")} placeholder="e.g. Main Warehouse" />
      <TextField label="Address" value={form.address} onChange={set("address")} placeholder="Street, city" />
      <TextAreaField label="Description" value={form.description} onChange={set("description")} rows={2} />
      {error && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <button style={btnSecondary()} onClick={onClose}>Cancel</button>
        <button style={btnPrimary()} onClick={() => form.name.trim() ? onSave(form) : setError("Warehouse name is required.")}>
          {initial ? "Save changes" : "Add warehouse"}
        </button>
      </div>
    </Modal>
  );
}

function ShelfModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { name: "", totalColumns: 3, totalParts: 4 });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title={initial ? "Edit shelf" : "Add shelf"} width={400} onClose={onClose}>
      <TextField label="Shelf name" required value={form.name} onChange={set("name")} placeholder="e.g. Shelf A1" />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><TextField label="Columns" type="number" min={1} value={form.totalColumns} onChange={set("totalColumns")} /></div>
        <div style={{ flex: 1 }}><TextField label="Parts per column" type="number" min={1} value={form.totalParts} onChange={set("totalParts")} /></div>
      </div>
      {error && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <button style={btnSecondary()} onClick={onClose}>Cancel</button>
        <button style={btnPrimary()} onClick={() => {
          if (!form.name.trim()) return setError("Shelf name is required.");
          onSave({ ...form, totalColumns: Math.max(1, Number(form.totalColumns) || 1), totalParts: Math.max(1, Number(form.totalParts) || 1) });
        }}>{initial ? "Save changes" : "Add shelf"}</button>
      </div>
    </Modal>
  );
}

function WarehousesPage({ data, mutate, toast }) {
  const { warehouses, shelves } = data;
  const [expanded, setExpanded] = useState(() => new Set());
  const [whModal, setWhModal] = useState(null);
  const [shelfModal, setShelfModal] = useState(null); // { warehouseId, shelf? }
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, item }

  const toggle = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const saveWarehouse = async (form) => {
    if (whModal.warehouse) {
      await mutate.updateWarehouse(whModal.warehouse.id, form);
      toast.push("success", `${form.name} updated.`);
    } else {
      await mutate.addWarehouse(form);
      toast.push("success", `${form.name} added.`);
    }
    setWhModal(null);
  };

  const saveShelf = async (form) => {
    if (shelfModal.shelf) {
      await mutate.updateShelf(shelfModal.shelf.id, form);
      toast.push("success", `${form.name} updated.`);
    } else {
      await mutate.addShelf(shelfModal.warehouseId, form);
      toast.push("success", `${form.name} added.`);
    }
    setShelfModal(null);
  };

  const doDelete = async () => {
    const { type, item } = confirmDelete;
    if (type === "warehouse") {
      await mutate.deleteWarehouse(item.id);
      toast.push("success", `${item.name} deleted.`);
    } else {
      await mutate.deleteShelf(item.id);
      toast.push("success", `${item.name} deleted.`);
    }
    setConfirmDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Warehouses"
        subtitle="Each warehouse holds shelves; each shelf defines its own column and part grid."
        action={<button style={btnPrimary()} onClick={() => setWhModal({})}><Plus size={15} /> Add warehouse</button>}
      />

      {data.loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => <div key={i} className="stockroom-skel" style={{ height: 58, borderRadius: 10, background: "#EEF1F3" }} />)}
        </div>
      ) : warehouses.length === 0 ? (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}>
          <EmptyState icon={WarehouseIcon} title="No warehouses yet" subtitle="Add a warehouse to start organizing storage." ctaLabel="Add warehouse" onCta={() => setWhModal({})} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {warehouses.map((w) => {
            const whShelves = shelves.filter((s) => s.warehouseId === w.id);
            const isOpen = expanded.has(w.id);
            return (
              <div key={w.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", cursor: "pointer" }} onClick={() => toggle(w.id)}>
                  {isOpen ? <ChevronDown size={16} color={COLORS.text600} /> : <ChevronRight size={16} color={COLORS.text600} />}
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.navy900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <WarehouseIcon size={16} color={COLORS.accent500} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text900 }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.text600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.address || "No address set"}</div>
                  </div>
                  <Badge tone="gray">{whShelves.length} shelves</Badge>
                  <button style={iconBtn()} onClick={(e) => { e.stopPropagation(); setWhModal({ warehouse: w }); }}><Pencil size={14} /></button>
                  <button style={iconBtn({ color: COLORS.danger })} onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "warehouse", item: w }); }}><Trash2 size={14} /></button>
                </div>
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${COLORS.border}`, background: "#FAFBFC" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          {["Shelf", "Columns", "Parts / column", "Total slots", ""].map((h) => (
                            <th key={h} style={{ textAlign: "left", padding: "8px 16px", fontSize: 11, fontWeight: 700, color: COLORS.text600, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {whShelves.length === 0 ? (
                          <tr><td colSpan={5} style={{ padding: "14px 16px", color: COLORS.text400 }}>No shelves in this warehouse yet.</td></tr>
                        ) : whShelves.map((s) => (
                          <tr key={s.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                            <td style={{ padding: "9px 16px", fontWeight: 600, color: COLORS.text900 }}>{s.name}</td>
                            <td style={{ padding: "9px 16px" }}><Mono>{s.totalColumns}</Mono></td>
                            <td style={{ padding: "9px 16px" }}><Mono>{s.totalParts}</Mono></td>
                            <td style={{ padding: "9px 16px" }}><Mono>{s.totalColumns * s.totalParts}</Mono></td>
                            <td style={{ padding: "9px 16px" }}>
                              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                <button style={iconBtn()} onClick={() => setShelfModal({ warehouseId: w.id, shelf: s })}><Pencil size={13} /></button>
                                <button style={iconBtn({ color: COLORS.danger })} onClick={() => setConfirmDelete({ type: "shelf", item: s })}><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: "10px 16px" }}>
                      <button style={btnSecondary({ padding: "6px 11px", fontSize: 12.5 })} onClick={() => setShelfModal({ warehouseId: w.id })}>
                        <Plus size={13} /> Add shelf
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {whModal && <WarehouseModal initial={whModal.warehouse} onClose={() => setWhModal(null)} onSave={saveWarehouse} />}
      {shelfModal && <ShelfModal initial={shelfModal.shelf} onClose={() => setShelfModal(null)} onSave={saveShelf} />}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.type}`}
          message={`Delete "${confirmDelete.item.name}"? ${confirmDelete.type === "warehouse" ? "This removes all its shelves and location assignments." : "This removes its location assignments."} This can't be undone.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

/* ----------------------------- Product Locations page ----------------------------- */

function LocationModal({ data, initial, onClose, onSave }) {
  const { warehouses, shelves, products } = data;
  const [form, setForm] = useState(initial || {
    productId: products[0]?.id || "", warehouseId: warehouses[0]?.id || "", shelfId: "", column: 1, part: 1, quantity: 0,
  });
  const [error, setError] = useState("");
  const shelfOptions = shelves.filter((s) => s.warehouseId === form.warehouseId);
  const selectedShelf = shelves.find((s) => s.id === form.shelfId);

  useEffect(() => {
    if (!shelfOptions.find((s) => s.id === form.shelfId)) {
      setForm((f) => ({ ...f, shelfId: shelfOptions[0]?.id || "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.warehouseId]);

  const submit = () => {
    if (!form.productId) return setError("Choose a product.");
    if (!form.warehouseId) return setError("Choose a warehouse.");
    if (!form.shelfId) return setError("Choose a shelf.");
    if (selectedShelf && (form.column > selectedShelf.totalColumns || form.part > selectedShelf.totalParts)) {
      return setError(`This shelf only has ${selectedShelf.totalColumns} columns and ${selectedShelf.totalParts} parts.`);
    }
    onSave({ ...form, column: Number(form.column), part: Number(form.part), quantity: Number(form.quantity) || 0 });
  };

  return (
    <Modal title={initial ? "Edit location" : "Assign location"} onClose={onClose}>
      <SelectField label="Product" required value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}>
        {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({(p.references || []).map((r) => r.code).join(", ") || "no ref"})</option>)}
      </SelectField>
      <SelectField label="Warehouse" required value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}>
        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </SelectField>
      <SelectField label="Shelf" required value={form.shelfId} onChange={(e) => setForm((f) => ({ ...f, shelfId: e.target.value }))}>
        {shelfOptions.length === 0 && <option value="">No shelves in this warehouse</option>}
        {shelfOptions.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.totalColumns}×{s.totalParts})</option>)}
      </SelectField>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <TextField label="Column" type="number" min={1} max={selectedShelf?.totalColumns || 99}
            value={form.column} onChange={(e) => setForm((f) => ({ ...f, column: e.target.value }))} />
        </div>
        <div style={{ flex: 1 }}>
          <TextField label="Part" type="number" min={1} max={selectedShelf?.totalParts || 99}
            value={form.part} onChange={(e) => setForm((f) => ({ ...f, part: e.target.value }))} />
        </div>
        <div style={{ flex: 1 }}>
          <TextField label="Quantity" type="number" min={0}
            value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
        </div>
      </div>
      {error && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <button style={btnSecondary()} onClick={onClose}>Cancel</button>
        <button style={btnPrimary()} onClick={submit}>{initial ? "Save changes" : "Assign location"}</button>
      </div>
    </Modal>
  );
}

function LocationsPage({ data, mutate, toast }) {
  const { locations, products, warehouses, shelves } = data;
  const [query, setQuery] = useState("");
  const [whFilter, setWhFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const warehouseById = useMemo(() => Object.fromEntries(warehouses.map((w) => [w.id, w])), [warehouses]);
  const shelfById = useMemo(() => Object.fromEntries(shelves.map((s) => [s.id, s])), [shelves]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locations.filter((l) => {
      const p = productById[l.productId];
      if (whFilter !== "all" && l.warehouseId !== whFilter) return false;
      if (!q) return true;
      return p && (p.name.toLowerCase().includes(q) || (p.references || []).some((r) => r.code.toLowerCase().includes(q)));
    });
  }, [locations, productById, query, whFilter]);

  const handleSave = async (form) => {
    if (modal.location) {
      await mutate.updateLocation(modal.location.id, form);
      toast.push("success", "Location updated.");
    } else {
      await mutate.addLocation(form);
      toast.push("success", "Location assigned.");
    }
    setModal(null);
  };

  const handleDelete = async () => {
    await mutate.deleteLocation(confirmDelete.id);
    toast.push("success", "Location removed.");
    setConfirmDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Product locations"
        subtitle="Every product-to-slot assignment across your warehouses."
        action={<button style={btnPrimary()} onClick={() => setModal({})} disabled={products.length === 0}><Plus size={15} /> Assign location</button>}
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Search by product name or reference" />
        <select value={whFilter} onChange={(e) => setWhFilter(e.target.value)} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13.5, fontFamily: "inherit", background: "#fff", color: COLORS.text900 }}>
          <option value="all">All warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 720 }}>
          <thead>
            <tr style={{ background: "#F8FAFB" }}>
              {["Product", "Warehouse", "Shelf", "Column", "Part", "Quantity", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11.5, fontWeight: 700, color: COLORS.text600, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.loading ? (
              <SkeletonRows rows={5} cols={7} />
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}>
                <EmptyState
                  icon={MapPin}
                  title={query || whFilter !== "all" ? "No matching locations" : "No locations assigned"}
                  subtitle={query || whFilter !== "all" ? "Try a different search or filter." : "Assign a product to a shelf slot to see it here."}
                  ctaLabel={query || whFilter !== "all" || products.length === 0 ? undefined : "Assign location"}
                  onCta={() => setModal({})}
                />
              </td></tr>
            ) : filtered.map((l) => {
              const p = productById[l.productId];
              const w = warehouseById[l.warehouseId];
              const s = shelfById[l.shelfId];
              return (
                <tr key={l.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: COLORS.text900 }}>{p?.name || "Unknown product"}</div>
                    <Mono style={{ color: COLORS.text400, fontSize: 12 }}>{(p?.references || []).map((r) => r.code).join(", ") || "—"}</Mono>
                  </td>
                  <td style={{ padding: "12px 16px", color: COLORS.text600 }}>{w?.name || "—"}</td>
                  <td style={{ padding: "12px 16px", color: COLORS.text600 }}>{s?.name || "—"}</td>
                  <td style={{ padding: "12px 16px" }}><Mono>{l.column}</Mono></td>
                  <td style={{ padding: "12px 16px" }}><Mono>{l.part}</Mono></td>
                  <td style={{ padding: "12px 16px" }}><Mono>{Number(l.quantity || 0).toLocaleString()}</Mono></td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button style={iconBtn()} onClick={() => setModal({ location: l })}><Pencil size={14} /></button>
                      <button style={iconBtn({ color: COLORS.danger })} onClick={() => setConfirmDelete(l)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && <LocationModal data={data} initial={modal.location} onClose={() => setModal(null)} onSave={handleSave} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Remove location"
          message="Remove this product from this storage slot? This can't be undone."
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

/* ----------------------------- Location Browser page ----------------------------- */

function BrowsePage({ data }) {
  const { warehouses, shelves, products, locations } = data;
  const [warehouseId, setWarehouseId] = useState(null);
  const [shelfId, setShelfId] = useState(null);

  useEffect(() => {
    if (!warehouseId && warehouses.length) setWarehouseId(warehouses[0].id);
  }, [warehouses, warehouseId]);

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const describeReference = (p) => {
    if (p.oem_reference) return p.oem_reference;
    if (p.references && p.references.length) return p.references[0].code;
    return null;
  };
  const whShelves = shelves.filter((s) => s.warehouseId === warehouseId);
  const shelf = shelves.find((s) => s.id === shelfId);

  const shelfItemCount = (sId) => locations.filter((l) => l.shelfId === sId).length;

  const grid = useMemo(() => {
    if (!shelf) return null;
    const map = {};
    locations.filter((l) => l.shelfId === shelf.id).forEach((l) => {
      const key = `${l.column}-${l.part}`;
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    return map;
  }, [locations, shelf]);

  if (data.loading) {
    return (
      <div>
        <PageHeader title="Location browser" subtitle="Navigate warehouses visually to see exactly what's stored where." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {[1, 2, 3].map((i) => <div key={i} className="stockroom-skel" style={{ height: 90, borderRadius: 10, background: "#EEF1F3" }} />)}
        </div>
      </div>
    );
  }

  if (warehouses.length === 0) {
    return (
      <div>
        <PageHeader title="Location browser" subtitle="Navigate warehouses visually to see exactly what's stored where." />
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}>
          <EmptyState icon={WarehouseIcon} title="No warehouses yet" subtitle="Add a warehouse first to browse its storage layout." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Location browser" subtitle="Navigate warehouses visually to see exactly what's stored where." />

      {/* breadcrumb / warehouse picker */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {warehouses.map((w) => (
          <button
            key={w.id}
            onClick={() => { setWarehouseId(w.id); setShelfId(null); }}
            style={{
              padding: "7px 13px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${w.id === warehouseId ? COLORS.navy900 : COLORS.border}`,
              background: w.id === warehouseId ? COLORS.navy900 : "#fff",
              color: w.id === warehouseId ? "#fff" : COLORS.text600,
              transition: "all 0.15s ease",
            }}
          >
            {w.name}
          </button>
        ))}
      </div>

      {!shelf ? (
        whShelves.length === 0 ? (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}>
            <EmptyState icon={Layers} title="No shelves in this warehouse" subtitle="Add a shelf from the Warehouses page to browse it here." />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
            {whShelves.map((s) => {
              const count = shelfItemCount(s.id);
              const capacity = s.totalColumns * s.totalParts;
              return (
                <button
                  key={s.id}
                  onClick={() => setShelfId(s.id)}
                  style={{
                    textAlign: "left", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10,
                    padding: "16px 16px", cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.steel600; e.currentTarget.style.boxShadow = "0 4px 14px rgba(15,41,66,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Layers size={16} color={COLORS.steel600} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.text900 }}>{s.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.text600, marginBottom: 8 }}>
                    <Mono>{s.totalColumns}×{s.totalParts}</Mono> grid · {capacity} slots
                  </div>
                  <Badge tone={count > 0 ? "amber" : "gray"}>{count} item{count === 1 ? "" : "s"} placed</Badge>
                </button>
              );
            })}
          </div>
        )
      ) : (
        <div>
          <button onClick={() => setShelfId(null)} style={{ ...btnSecondary({ padding: "6px 11px", fontSize: 12.5 }), marginBottom: 14 }}>
            <ChevronLeft size={14} /> Back to shelves
          </button>
          <div style={{ background: COLORS.navy950, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Layers size={17} color={COLORS.accent500} />
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{shelf.name}</span>
              </div>
              <Mono style={{ color: "#9FB3C4", fontSize: 12 }}>{shelf.totalColumns} columns × {shelf.totalParts} parts</Mono>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${shelf.totalColumns}, minmax(120px, 1fr))`,
              gap: 10, overflowX: "auto",
            }}>
              {Array.from({ length: shelf.totalColumns }).map((_, ci) => (
                <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ textAlign: "center", fontFamily: "'Fira Code', monospace", fontSize: 11, color: "#6E8399", letterSpacing: 1 }}>COL {ci + 1}</div>
                  {Array.from({ length: shelf.totalParts }).map((__, pi) => {
                    const slotLocations = grid[`${ci + 1}-${pi + 1}`] || [];
                    const hasProducts = slotLocations.length > 0;
                    return (
                      <div
                        key={pi}
                        style={{
                          background: hasProducts ? "#1C3A54" : "#122A3E",
                          border: `1px solid ${hasProducts ? COLORS.accent500 : "#254865"}`,
                          borderRadius: 8, padding: "10px 10px", minHeight: 64, position: "relative",
                        }}
                      >
                        <div style={{ position: "absolute", top: 6, right: 8, fontFamily: "'Fira Code', monospace", fontSize: 9.5, color: "#5C7A93" }}>
                          {ci + 1}-{pi + 1}
                        </div>
                        {hasProducts ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {slotLocations.map((loc) => {
                              const product = productById[loc.productId];
                              if (!product) return null;
                              const ref = describeReference(product);
                              return (
                                <div key={loc.id} style={{ paddingRight: 20 }}>
                                  <div style={{ color: "#fff", fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{product.name}</div>
                                  {ref && (
                                    <div style={{ fontFamily: "'Fira Code', monospace", fontSize: 10.5, color: "#6E8399", marginBottom: 3 }}>{ref}</div>
                                  )}
                                  <div style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, color: COLORS.accent500, fontWeight: 600 }}>{Number(loc.quantity || 0).toLocaleString()}</div>
                                  <div style={{ fontSize: 10.5, color: "#8FA6B8", marginTop: 2 }}>{product.piece_product_name || ""}</div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ color: "#4A6478", fontSize: 11.5, marginTop: 20, textAlign: "center" }}>Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Connection trouble screen ----------------------------- */

function ConnectionTrouble({ title, detail, hints, onRetry }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: COLORS.navy950, fontFamily: "'Fira Sans', -apple-system, sans-serif", padding: 16,
    }}>
      <style>{FONT_IMPORT}</style>
      <div style={{
        background: COLORS.card, borderRadius: 14, padding: "28px 26px", width: 480, maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: COLORS.dangerBg, display: "flex",
          alignItems: "center", justifyContent: "center", marginBottom: 14,
        }}>
          <AlertTriangle size={20} color={COLORS.danger} />
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: COLORS.text900 }}>{title}</h1>

        {detail && (
          <pre style={{
            margin: "0 0 14px", fontFamily: "'Fira Code', monospace", fontSize: 11.5, color: COLORS.text600,
            background: "#F8FAFB", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>{detail}</pre>
        )}

        <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.text900, marginBottom: 6 }}>Try this:</div>
        <ul style={{ margin: "0 0 18px", paddingLeft: 18, fontSize: 12.5, color: COLORS.text600, lineHeight: 1.6 }}>
          {hints.map((h, i) => <li key={i} style={{ marginBottom: 4 }}>{h}</li>)}
        </ul>

        <button onClick={onRetry} style={{ ...btnPrimary(), width: "100%", justifyContent: "center", padding: "10px 14px" }}>
          Try again
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Shared password gate ----------------------------- */

function PasswordGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (value === SHARED_PASSWORD) {
      try { window.sessionStorage.setItem(AUTH_SESSION_KEY, "1"); } catch {}
      onUnlock();
    } else {
      setError("Incorrect password. Ask your team for the shared password.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: COLORS.navy950, fontFamily: "'Fira Sans', -apple-system, sans-serif", padding: 16,
    }}>
      <style>{FONT_IMPORT}</style>
      <form onSubmit={submit} style={{
        background: COLORS.card, borderRadius: 14, padding: "32px 28px", width: 360, maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: COLORS.navy900, display: "flex",
          alignItems: "center", justifyContent: "center", marginBottom: 16,
        }}>
          <Boxes size={22} color={COLORS.accent500} />
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 700, color: COLORS.text900 }}>Stockroom</h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: COLORS.text600 }}>Enter the shared team password to access the shared inventory.</p>

        <div style={{ position: "relative", marginBottom: error ? 8 : 20 }}>
          <Lock size={15} color={COLORS.text400} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type={show ? "text" : "password"}
            autoFocus
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            placeholder="Shared password"
            style={{
              width: "100%", boxSizing: "border-box", border: `1px solid ${error ? COLORS.danger : COLORS.border}`,
              borderRadius: 8, padding: "10px 38px 10px 34px", fontSize: 14, fontFamily: "inherit", outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: COLORS.text400, padding: 4 }}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {error && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

        <button type="submit" style={{ ...btnPrimary(), width: "100%", justifyContent: "center", padding: "10px 14px" }}>
          Unlock Stockroom
        </button>
      </form>
    </div>
  );
}

/* ----------------------------- Root App ----------------------------- */

function AppShell() {
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [stuck, setStuck] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sales, setSales] = useState([]);
  const [retryTick, setRetryTick] = useState(0);
  const { toasts, push, dismiss } = useToasts();

  // Subscribe to Firestore in real time (fires for changes made by anyone, on any device)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setStuck(false);

    let ready = { warehouses: false, shelves: false, products: false, locations: false, sales: false };
    const checkReady = () => {
      if (!cancelled && Object.values(ready).every(Boolean)) setLoading(false);
    };
    const handleError = (err, name) => {
      if (cancelled) return;
      setLoadError({
        code: err?.code || "unknown",
        message: err?.message || String(err),
        collection: name,
      });
    };

    (async () => {
      // Seed the shared database once, the first time it's ever empty.
      try {
        const empty = await collectionIsEmpty(COLLECTIONS.warehouses);
        if (empty) {
          const seed = seedData();
          const batch = writeBatch(db);
          seed.warehouses.forEach((w) => batch.set(doc(db, COLLECTIONS.warehouses, w.id), w));
          seed.shelves.forEach((s) => batch.set(doc(db, COLLECTIONS.shelves, s.id), s));
          seed.products.forEach((p) => batch.set(doc(db, COLLECTIONS.products, p.id), p));
          seed.locations.forEach((l) => batch.set(doc(db, COLLECTIONS.locations, l.id), l));
          seed.sales.forEach((sa) => batch.set(doc(db, COLLECTIONS.sales, sa.id), sa));
          await batch.commit();
        }
      } catch (e) {
        console.error("Seeding failed:", e);
        handleError(e, "seed");
      }
    })();

    const unsubs = [
      subscribeCollection(COLLECTIONS.warehouses, (rows) => { setWarehouses(rows); ready.warehouses = true; checkReady(); }, handleError),
      subscribeCollection(COLLECTIONS.shelves, (rows) => { setShelves(rows); ready.shelves = true; checkReady(); }, handleError),
      subscribeCollection(COLLECTIONS.products, (rows) => { setProducts(rows); ready.products = true; checkReady(); }, handleError),
      subscribeCollection(COLLECTIONS.locations, (rows) => { setLocations(rows); ready.locations = true; checkReady(); }, handleError),
      subscribeCollection(COLLECTIONS.sales, (rows) => { setSales(rows); ready.sales = true; checkReady(); }, handleError),
    ];

    const stuckTimer = setTimeout(() => {
      if (!cancelled) setStuck(true);
    }, 7000);

    return () => {
      cancelled = true;
      clearTimeout(stuckTimer);
      unsubs.forEach((u) => u());
    };
  }, [retryTick]);

  const toast = { push };

  const mutate = {
    addProduct: async (form) => {
      const item = { id: uid("pr"), ...form };
      await setDocById(COLLECTIONS.products, item.id, item);
      return item;
    },
    updateProduct: async (id, form) => {
      await setDocById(COLLECTIONS.products, id, { ...products.find((p) => p.id === id), ...form, id });
    },
    deleteProduct: async (id) => {
      const batch = writeBatch(db);
      batch.delete(doc(db, COLLECTIONS.products, id));
      locations.filter((l) => l.productId === id).forEach((l) => batch.delete(doc(db, COLLECTIONS.locations, l.id)));
      await batch.commit();
    },
    addWarehouse: async (form) => {
      const item = { id: uid("wh"), ...form };
      await setDocById(COLLECTIONS.warehouses, item.id, item);
    },
    updateWarehouse: async (id, form) => {
      await setDocById(COLLECTIONS.warehouses, id, { ...warehouses.find((w) => w.id === id), ...form, id });
    },
    deleteWarehouse: async (id) => {
      const removedShelfIds = new Set(shelves.filter((s) => s.warehouseId === id).map((s) => s.id));
      const batch = writeBatch(db);
      batch.delete(doc(db, COLLECTIONS.warehouses, id));
      shelves.filter((s) => s.warehouseId === id).forEach((s) => batch.delete(doc(db, COLLECTIONS.shelves, s.id)));
      locations.filter((l) => l.warehouseId === id || removedShelfIds.has(l.shelfId)).forEach((l) => batch.delete(doc(db, COLLECTIONS.locations, l.id)));
      await batch.commit();
    },
    addShelf: async (warehouseId, form) => {
      const item = { id: uid("sh"), warehouseId, ...form };
      await setDocById(COLLECTIONS.shelves, item.id, item);
    },
    updateShelf: async (id, form) => {
      await setDocById(COLLECTIONS.shelves, id, { ...shelves.find((s) => s.id === id), ...form, id });
    },
    deleteShelf: async (id) => {
      const batch = writeBatch(db);
      batch.delete(doc(db, COLLECTIONS.shelves, id));
      locations.filter((l) => l.shelfId === id).forEach((l) => batch.delete(doc(db, COLLECTIONS.locations, l.id)));
      await batch.commit();
    },
    addLocation: async (form) => {
      const item = { id: uid("loc"), ...form };
      await setDocById(COLLECTIONS.locations, item.id, item);
    },
    updateLocation: async (id, form) => {
      await setDocById(COLLECTIONS.locations, id, { ...locations.find((l) => l.id === id), ...form, id });
    },
    deleteLocation: async (id) => {
      await deleteDocById(COLLECTIONS.locations, id);
    },
    addSale: async (productId, form) => {
      const sale = { id: uid("sale"), productId, ...form };
      const product = products.find((p) => p.id === productId);
      const nextQuantity = Math.max(0, Number(product?.total_quantity || 0) - Number(form.quantity || 0));
      const batch = writeBatch(db);
      batch.set(doc(db, COLLECTIONS.sales, sale.id), sale);
      batch.set(doc(db, COLLECTIONS.products, productId), { ...product, total_quantity: nextQuantity, id: productId });

      // Also deduct the sold quantity from the product's actual storage location(s),
      // so Product Locations stays in sync with what was sold.
      let remaining = Number(form.quantity || 0);
      const productLocations = locations.filter((l) => l.productId === productId);
      for (const loc of productLocations) {
        if (remaining <= 0) break;
        const currentQty = Number(loc.quantity || 0);
        const deduct = Math.min(remaining, currentQty);
        if (deduct > 0) {
          batch.set(doc(db, COLLECTIONS.locations, loc.id), { ...loc, quantity: currentQty - deduct, id: loc.id });
          remaining -= deduct;
        }
      }

      await batch.commit();
    },
  };

  const data = { warehouses, shelves, products, locations, sales, loading };

  if (loadError) {
    return (
      <ConnectionTrouble
        title="Couldn't connect to Firestore"
        detail={`${loadError.collection ? `Collection: ${loadError.collection}\n` : ""}Code: ${loadError.code}\nMessage: ${loadError.message}`}
        hints={[
          loadError.code === "permission-denied"
            ? "This almost always means your Firestore security rules are blocking access. Open Firestore Database → Rules in the Firebase console and make sure they allow read/write (see the setup notes near the top of this file)."
            : "Double-check the firebaseConfig values (apiKey, projectId, etc.) match exactly what's shown in Firebase console → Project settings → Your apps.",
          "Make sure you've actually created a Firestore database for this project (Build/Bases de données et stockage → Firestore Database → Create database).",
          "Confirm you have an internet connection and nothing (firewall, VPN, ad blocker) is blocking requests to *.googleapis.com.",
        ]}
        onRetry={() => setRetryTick((t) => t + 1)}
      />
    );
  }

  if (loading && stuck) {
    return (
      <ConnectionTrouble
        title="Still loading after several seconds"
        detail="No error came back from Firestore, but nothing loaded either — this usually means the request never left the browser."
        hints={[
          "If you're viewing this inside another app's built-in preview/iframe (like a chat tool's Code tab), that preview may be blocking the scripts this page needs to load. Try opening this file directly in a normal browser tab instead.",
          "Open your browser console (F12 → Console) and look for a red error — a blocked script, a network failure, or a Firestore error will show up there even if this screen doesn't say why.",
          "Check your internet connection.",
        ]}
        onRetry={() => setRetryTick((t) => t + 1)}
      />
    );
  }

  return (
    <div style={{ fontFamily: "'Fira Sans', -apple-system, sans-serif", height: "100%", minHeight: "100vh", display: "flex", background: COLORS.canvas }}>
      <style>{`
        ${FONT_IMPORT}
        @keyframes stockroom-pop-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes stockroom-slide-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes stockroom-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        .stockroom-skel { animation: stockroom-pulse 1.3s ease-in-out infinite; }
        table { font-family: 'Fira Sans', sans-serif; }
        button:active { transform: scale(0.98); }
        select, input, textarea { font-family: 'Fira Sans', sans-serif; }
        @media (max-width: 760px) {
          .stockroom-sidebar-mobile { position: fixed !important; height: 100vh !important; }
        }
      `}</style>

      <div style={{ display: window.innerWidth < 760 && !mobileOpen ? "none" : "block" }}>
        <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "none", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.card,
        }} className="stockroom-mobile-topbar">
          <button onClick={() => setMobileOpen(true)} style={iconBtn()}><Menu size={16} /></button>
          <span style={{ fontWeight: 700, color: COLORS.text900 }}>Stockroom</span>
        </div>

        <div style={{ padding: "24px 28px 60px", overflowY: "auto", flex: 1 }}>
          {page === "dashboard" && <Dashboard data={data} loading={loading} setPage={setPage} />}
          {page === "products" && <ProductsPage data={data} mutate={mutate} toast={toast} />}
          {page === "warehouses" && <WarehousesPage data={data} mutate={mutate} toast={toast} />}
          {page === "locations" && <LocationsPage data={data} mutate={mutate} toast={toast} />}
          {page === "browse" && <BrowsePage data={data} />}
        </div>
      </div>

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => {
    try { return window.sessionStorage.getItem(AUTH_SESSION_KEY) === "1"; } catch { return false; }
  });

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }
  return <AppShell />;
}
