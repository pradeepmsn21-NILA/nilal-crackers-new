/*
=========================================================
 NIZHAL CRACKERS - SERVER.JS
 Express Backend
=========================================================
*/

const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

/*
=========================================================
 EXPRESS SETTINGS
=========================================================
*/

// PDF Upload மற்றும் பெரிய அளவிலான தரவுகளுக்காக 50mb ஆக உயர்த்தப்பட்டுள்ளது
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/*
=========================================================
 STATIC FRONTEND
=========================================================
*/

const publicPath = __dirname;
app.use(express.static(publicPath));

/*
=========================================================
 SETTINGS & CONFIGURATION
=========================================================
*/

const GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyj2CSePhowZmXWs0btv1ZAQiJVe8omd57GVoDUjSUMBChIZ3R8cyZdbsmafRkkpgGK_A/exec";

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || "";
const OWNER_APP_KEY = process.env.OWNER_APP_KEY || "Pranila/1522-";

/*
=========================================================
 OWNER SECURITY MIDDLEWARE
=========================================================
*/

function requireOwnerKey(req, res, next) {
  const suppliedKey = String(
    req.headers["x-owner-key"] || req.query.key || req.body?.key || ""
  ).trim();

  if (!OWNER_APP_KEY) {
    return res.status(500).json({
      ok: false,
      error: "OWNER_APP_KEY is not configured on the server."
    });
  }

  if (suppliedKey !== OWNER_APP_KEY) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized owner access."
    });
  }

  next();
}

/*
=========================================================
 HEALTH CHECK
=========================================================
*/

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Nizhal Crackers",
    message: "Server is running",
    time: new Date().toISOString()
  });
});

/*
=========================================================
 PRODUCTS API (Price 0 பிழை திருத்தப்பட்டது)
=========================================================
*/

app.get("/api/products", async (req, res) => {
  try {
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Google Apps Script returned HTTP " + response.status);
    }

    const data = await response.json();
    let rawProducts = Array.isArray(data) ? data : (data.products || data.data || []);

    if (!Array.isArray(rawProducts)) {
      throw new Error("Google Apps Script did not return an array.");
    }

    // தயாரிப்பு விலைகளை சரியாக Number ஆக மாற்றுதல்
    const products = rawProducts.map((p) => {
      const priceVal = p.price ?? p.Price ?? p.rate ?? p.Rate ?? p.mrp ?? 0;
      return {
        ...p,
        price: Number(priceVal) || 0
      };
    });

    res.json(products);
  } catch (error) {
    console.error("PRODUCT API ERROR:", error);
    res.status(500).json({
      ok: false,
      error: "Products could not be loaded.",
      details: error.message
    });
  }
});

/*
=========================================================
 reCAPTCHA VERIFICATION
=========================================================
*/

app.post("/api/verify-recaptcha", async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();

    if (!token) {
      return res.status(400).json({
        ok: false,
        error: "reCAPTCHA token is missing."
      });
    }

    if (!RECAPTCHA_SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        error: "RECAPTCHA_SECRET_KEY is not configured on the server."
      });
    }

    const googleResponse = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          secret: RECAPTCHA_SECRET_KEY,
          response: token
        }).toString()
      }
    );

    const result = await googleResponse.json();

    if (!result.success) {
      console.error("reCAPTCHA FAILED:", result);
      return res.status(403).json({
        ok: false,
        error: "reCAPTCHA verification failed.",
        details: result["error-codes"] || []
      });
    }

    res.json({
      ok: true,
      message: "reCAPTCHA verified successfully."
    });
  } catch (error) {
    console.error("RECAPTCHA ERROR:", error);
    res.status(500).json({
      ok: false,
      error: "reCAPTCHA verification error.",
      details: error.message
    });
  }
});

/*
=========================================================
 PDF UPLOAD API (Upload Fail பிழை திருத்தப்பட்டது)
=========================================================
*/

app.post("/api/upload-pdf", async (req, res) => {
  try {
    const pdfBase64 = String(req.body.pdfBase64 || "").trim();
    const fileName = String(
      req.body.fileName || "Nizhal_Crackers_Order.pdf"
    ).trim();

    if (!pdfBase64) {
      return res.status(400).json({ ok: false, error: "PDF data is missing." });
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/i, "");

    if (cleanBase64.length < 100) {
      return res.status(400).json({ ok: false, error: "Invalid PDF data." });
    }

    console.log("Uploading PDF:", fileName);

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      redirect: "follow",
      body: JSON.stringify({
        action: "uploadPdf",
        pdfBase64: cleanBase64,
        fileName: fileName
      })
    });

    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!response.ok) {
      throw new Error(
        "Google Apps Script PDF upload failed. HTTP " + response.status
      );
    }

    const viewUrl =
      data.viewUrl || data.url || data.fileUrl || data.webViewLink || "";
    const downloadUrl = data.downloadUrl || "";

    res.json({
      ok: data.ok !== false,
      message: data.message || "PDF uploaded successfully.",
      viewUrl: viewUrl,
      downloadUrl: downloadUrl,
      fileName: fileName
    });
  } catch (error) {
    console.error("PDF UPLOAD ERROR:", error);
    res.status(500).json({
      ok: false,
      error: "PDF upload failed.",
      details: error.message
    });
  }
});

/*
=========================================================
 ORDER HISTORY API
=========================================================
*/

app.get("/api/order-history", async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();

    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: "Mobile number is required.",
        orders: []
      });
    }

    const url =
      GOOGLE_APPS_SCRIPT_URL +
      "?action=getOrderHistory&phone=" +
      encodeURIComponent(phone);

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        ok: false,
        error: "Invalid response from Google Apps Script.",
        raw: text
      };
    }

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Order history service failed.",
        details: data
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("ORDER HISTORY ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: "Could not load order history.",
      details: error.message,
      orders: []
    });
  }
});

/*
=========================================================
 ORDER SAVE API
=========================================================
*/

app.post("/api/order", async (req, res) => {
  try {
    const order = req.body;

    if (!order) {
      return res.status(400).json({
        ok: false,
        error: "Order data is missing."
      });
    }

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      redirect: "follow",
      body: JSON.stringify({
        action: "saveOrder",
        order: order
      })
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    res.json({
      ok: data.ok !== false,
      data: data
    });
  } catch (error) {
    console.error("ORDER SAVE ERROR:", error);
    res.status(500).json({
      ok: false,
      error: "Order could not be saved.",
      details: error.message
    });
  }
});

/*
=========================================================
 OWNER APP ROUTES
=========================================================
*/

app.get("/api/owner/orders", requireOwnerKey, async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();

    let url = GOOGLE_APPS_SCRIPT_URL + "?action=getOwnerOrders";
    if (status) {
      url += "&status=" + encodeURIComponent(status);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Owner-Key": OWNER_APP_KEY
      },
      cache: "no-store"
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        ok: false,
        error: "Invalid response from Google Apps Script.",
        raw: text
      };
    }

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Owner order service failed.",
        details: data
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("OWNER ORDERS ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: "Could not load owner orders.",
      details: error.message,
      orders: []
    });
  }
});

app.get("/api/owner/new-count", requireOwnerKey, async (req, res) => {
  try {
    const url = GOOGLE_APPS_SCRIPT_URL + "?action=getNewOrderCount";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Owner-Key": OWNER_APP_KEY
      },
      cache: "no-store"
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        ok: false,
        error: "Invalid response from Google Apps Script.",
        raw: text
      };
    }

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "New order count service failed.",
        details: data
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("OWNER COUNT ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: "Could not get new order count.",
      details: error.message
    });
  }
});

app.post("/api/owner/order-status", requireOwnerKey, async (req, res) => {
  try {
    const orderId = String(req.body.orderId || "").trim();
    const status = String(req.body.status || "").trim();

    if (!orderId) {
      return res.status(400).json({ ok: false, error: "Order ID is required." });
    }

    if (!status) {
      return res
        .status(400)
        .json({ ok: false, error: "Order status is required." });
    }

    const allowedStatuses = [
      "New",
      "Confirmed",
      "Preparing",
      "Delivered",
      "Cancelled"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid order status.",
        allowedStatuses: allowedStatuses
      });
    }

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      redirect: "follow",
      body: JSON.stringify({
        action: "updateOrderStatus",
        key: OWNER_APP_KEY,
        orderId: orderId,
        status: status
      })
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        ok: false,
        error: "Invalid response from Google Apps Script.",
        raw: text
      };
    }

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Order status service failed.",
        details: data
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("OWNER STATUS ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: "Could not update order status.",
      details: error.message
    });
  }
});

app.get("/api/owner/health", requireOwnerKey, (req, res) => {
  res.json({
    ok: true,
    service: "Nizhal Crackers Owner API",
    message: "Owner API is working."
  });
});

/*
=========================================================
 404 API RESPONSE
=========================================================
*/

app.use("/api", (req, res) => {
  res.status(404).json({
    ok: false,
    error: "API endpoint not found."
  });
});

/*
=========================================================
 SITEMAP (Frontend Fallback-க்கு முன் வர வேண்டும்)
=========================================================
*/

app.get("/sitemap.xml", (req, res) => {
  res.header("Content-Type", "application/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://nizhalcrackers.online/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
});

/*
=========================================================
 FRONTEND FALLBACK (கடைசியாக வர வேண்டும்)
=========================================================
*/

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

/*
=========================================================
 START SERVER
=========================================================
*/

app.listen(PORT, "0.0.0.0", () => {
  console.log("======================================");
  console.log(" NIZHAL CRACKERS SERVER");
  console.log("======================================");
  console.log("Server running on port:", PORT);
  console.log("Frontend:", publicPath);
  console.log("======================================");
});
