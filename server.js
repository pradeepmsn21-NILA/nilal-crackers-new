```javascript
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

// Render Environment Variables-ல் OWNER_APP_KEY அமைக்கவும்.
const OWNER_APP_KEY = process.env.OWNER_APP_KEY || "Pranila/1522-";

/*
=========================================================
 HELPER FUNCTIONS
=========================================================
*/

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getProductsArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data)) return data.data;
  return null;
}

/*
=========================================================
 OWNER SECURITY MIDDLEWARE
=========================================================
*/

function requireOwnerKey(req, res, next) {
  const suppliedKey = String(
    req.headers["x-owner-key"] ||
    req.query.key ||
    req.body?.key ||
    ""
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
 PRODUCTS API
 FIX: price now uses discounted sellingPrice
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
      throw new Error(
        "Google Apps Script returned HTTP " + response.status
      );
    }

    const data = await response.json();
    const rawProducts = getProductsArray(data);

    if (!rawProducts) {
      throw new Error("Google Apps Script did not return a product array.");
    }

    const products = rawProducts
      .map((p) => {
        const mrp = Math.max(
          0,
          Number(p.mrp ?? p.MRP ?? 0) || 0
        );

        const discount = Math.min(
          100,
          Math.max(
            0,
            Number(p.discount ?? p["Discount %"] ?? 0) || 0
          )
        );

        const suppliedSellingPrice = Number(
          p.sellingPrice ?? p["Selling Price"] ?? 0
        ) || 0;

        let sellingPrice;

        if (discount === 0) {
          sellingPrice =
            suppliedSellingPrice > 0 ? suppliedSellingPrice : mrp;
        } else if (
          suppliedSellingPrice > 0 &&
          suppliedSellingPrice < mrp
        ) {
          sellingPrice = suppliedSellingPrice;
        } else {
          sellingPrice = mrp * (1 - discount / 100);
        }

        sellingPrice = Number(sellingPrice.toFixed(2));

        return {
          ...p,
          mrp: mrp,
          discount: discount,
          sellingPrice: sellingPrice,

          // முக்கியம்: frontend-க்கு discounted price அனுப்பப்படுகிறது.
          price: sellingPrice
        };
      })
      // Google Sheet-ல் உள்ள காலியான வரிகளை நீக்குகிறது.
      .filter((p) => {
        const name = String(p.name ?? p["Cracker Name"] ?? "").trim();
        return name !== "" && (Number(p.mrp) > 0 || Number(p.sellingPrice) > 0);
      });

    res.set("Cache-Control", "no-store");
    return res.json(products);

  } catch (error) {
    console.error("PRODUCT API ERROR:", error);

    return res.status(500).json({
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
    const token = String(req.body?.token || "").trim();

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

    return res.json({
      ok: true,
      message: "reCAPTCHA verified successfully."
    });

  } catch (error) {
    console.error("RECAPTCHA ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "reCAPTCHA verification error.",
      details: error.message
    });
  }
});

/*
=========================================================
 PDF UPLOAD API
=========================================================
*/

app.post("/api/upload-pdf", async (req, res) => {
  try {
    const pdfBase64 = String(req.body?.pdfBase64 || "").trim();

    const fileName = String(
      req.body?.fileName || "Nizhal_Crackers_Order.pdf"
    ).trim();

    if (!pdfBase64) {
      return res.status(400).json({
        ok: false,
        error: "PDF data is missing."
      });
    }

    const cleanBase64 = pdfBase64.replace(
      /^data:application\/pdf;base64,/i,
      ""
    );

    if (
      cleanBase64.length < 100 ||
      !/^[A-Za-z0-9+/=\s]+$/.test(cleanBase64)
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid PDF data."
      });
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
        pdfBase64: cleanBase64.replace(/\s/g, ""),
        fileName: fileName
      })
    });

    const responseText = await response.text();
    const data = parseJson(responseText);

    if (!response.ok) {
      throw new Error(
        "Google Apps Script PDF upload failed. HTTP " + response.status
      );
    }

    if (!data || data.ok === false) {
      return res.status(502).json({
        ok: false,
        error: data?.error || "Google Apps Script could not upload the PDF.",
        details: data || responseText
      });
    }

    const viewUrl =
      data.viewUrl ||
      data.url ||
      data.fileUrl ||
      data.webViewLink ||
      "";

    const downloadUrl = data.downloadUrl || "";

    return res.json({
      ok: true,
      message: data.message || "PDF uploaded successfully.",
      viewUrl: viewUrl,
      downloadUrl: downloadUrl,
      fileName: data.fileName || fileName
    });

  } catch (error) {
    console.error("PDF UPLOAD ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "PDF upload failed.",
      details: error.message
    });
  }
});

/*
=========================================================
 CUSTOMER ORDER HISTORY API
 Preserves PDF URL fields returned by Apps Script.
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

    const responseText = await response.text();
    const data = parseJson(responseText);

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Order history service failed.",
        details: data || responseText,
        orders: []
      });
    }

    if (!data) {
      return res.status(502).json({
        ok: false,
        error: "Invalid response from Google Apps Script.",
        orders: []
      });
    }

    // Keep all returned order fields, including PDF URL.
    const orders = Array.isArray(data)
      ? data
      : (Array.isArray(data.orders) ? data.orders : []);

    res.set("Cache-Control", "no-store");

    return res.json({
      ...(!Array.isArray(data) ? data : {}),
      ok: data.ok !== false,
      orders: orders
    });

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
 CUSTOMER ORDER SAVE API
=========================================================
*/

app.post("/api/order", async (req, res) => {
  try {
    const order = req.body;

    if (!order || typeof order !== "object" || Array.isArray(order)) {
      return res.status(400).json({
        ok: false,
        error: "Order data is missing or invalid."
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

    const responseText = await response.text();
    const data = parseJson(responseText);

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Google Apps Script failed to save the order.",
        details: data || responseText
      });
    }

    if (!data) {
      return res.status(502).json({
        ok: false,
        error: "Invalid response from Google Apps Script.",
        details: responseText
      });
    }

    if (data.ok === false) {
      return res.status(502).json({
        ok: false,
        error: data.error || "Order could not be saved.",
        data: data
      });
    }

    return res.json({
      ok: true,
      data: data
    });

  } catch (error) {
    console.error("ORDER SAVE ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "Order could not be saved.",
      details: error.message
    });
  }
});

/*
=========================================================
 OWNER APP - GET ORDERS
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
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    const responseText = await response.text();
    const data = parseJson(responseText);

    if (!response.ok || !data) {
      return res.status(502).json({
        ok: false,
        error: "Owner order service failed.",
        details: data || responseText
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

/*
=========================================================
 OWNER APP - NEW ORDER COUNT
=========================================================
*/

app.get("/api/owner/new-count", requireOwnerKey, async (req, res) => {
  try {
    const url = GOOGLE_APPS_SCRIPT_URL + "?action=getNewOrderCount";

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    const responseText = await response.text();
    const data = parseJson(responseText);

    if (!response.ok || !data) {
      return res.status(502).json({
        ok: false,
        error: "New order count service failed.",
        details: data || responseText
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

/*
=========================================================
 OWNER APP - UPDATE ORDER STATUS
=========================================================
*/

app.post("/api/owner/order-status", requireOwnerKey, async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || "").trim();
    const status = String(req.body?.status || "").trim();

    if (!orderId) {
      return res.status(400).json({
        ok: false,
        error: "Order ID is required."
      });
    }

    if (!status) {
      return res.status(400).json({
        ok: false,
        error: "Order status is required."
      });
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

    const responseText = await response.text();
    const data = parseJson(responseText);

    if (!response.ok || !data) {
      return res.status(502).json({
        ok: false,
        error: "Order status service failed.",
        details: data || responseText
      });
    }

    if (data.ok === false) {
      return res.status(502).json(data);
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

/*
=========================================================
 OWNER APP - HEALTH CHECK
=========================================================
*/

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
 SITEMAP
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
 FRONTEND FALLBACK
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
```
