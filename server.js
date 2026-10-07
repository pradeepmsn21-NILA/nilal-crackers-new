/*
=========================================================
 NIZHAL CRACKERS - SERVER.JS
 Express Backend

 Customer Website
 Products API
 PDF Upload Proxy
 reCAPTCHA Verification
 WhatsApp Support
 Order History
 Order Save

 Owner App
 New Orders
 Order Count
 Order Status Update
=========================================================
*/

const express = require("express");
const path = require("path");

const app = express();

/*
=========================================================
 PORT
=========================================================
*/

const PORT = process.env.PORT || 3000;

/*
=========================================================
 EXPRESS SETTINGS
=========================================================
*/

app.use(
  express.json({
    limit: "25mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "25mb"
  })
);

/*
=========================================================
 STATIC FRONTEND
=========================================================
*/

const publicPath = __dirname;

app.use(express.static(publicPath));

/*
=========================================================
 SETTINGS
=========================================================
*/

const GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyj2CSePhowZmXWs0btv1ZAQiJVe8omd57GVoDUjSUMBChIZ3R8cyZdbsmafRkkpgGK_A/exec";

const RECAPTCHA_SECRET_KEY =
  process.env.RECAPTCHA_SECRET_KEY || "";

/*
=========================================================
 OWNER APP SECURITY KEY

 Set this in your server environment:

 OWNER_APP_KEY=NILAL_OWNER_2026_8472

 IMPORTANT:
 This must match the OWNER_APP_KEY in Apps Script.
=========================================================
*/

const OWNER_APP_KEY =
  process.env.OWNER_APP_KEY || "";


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
=========================================================
*/

app.get("/api/products", async (req, res) => {

  try {

    const response = await fetch(
      GOOGLE_APPS_SCRIPT_URL,
      {
        method: "GET",

        headers: {
          Accept: "application/json"
        },

        cache: "no-store"
      }
    );

    if (!response.ok) {

      throw new Error(
        "Google Apps Script returned HTTP " +
        response.status
      );

    }

    const data =
      await response.json();

    let products = data;

    if (
      data &&
      Array.isArray(data.products)
    ) {

      products =
        data.products;

    }

    if (
      data &&
      Array.isArray(data.data)
    ) {

      products =
        data.data;

    }

    if (!Array.isArray(products)) {

      throw new Error(
        "Google Apps Script did not return an array."
      );

    }

    res.json(products);

  } catch (error) {

    console.error(
      "PRODUCT API ERROR:",
      error
    );

    res.status(500).json({

      ok: false,

      error:
        "Products could not be loaded.",

      details:
        error.message

    });

  }

});


/*
=========================================================
 reCAPTCHA VERIFICATION
=========================================================
*/

app.post(
  "/api/verify-recaptcha",
  async (req, res) => {

    try {

      const token =
        String(
          req.body.token || ""
        ).trim();

      if (!token) {

        return res.status(400).json({

          ok: false,

          error:
            "reCAPTCHA token is missing."

        });

      }

      if (!RECAPTCHA_SECRET_KEY) {

        return res.status(500).json({

          ok: false,

          error:
            "RECAPTCHA_SECRET_KEY is not configured on the server."

        });

      }

      const googleResponse =
        await fetch(
          "https://www.google.com/recaptcha/api/siteverify",
          {

            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded"
            },

            body:
              new URLSearchParams({

                secret:
                  RECAPTCHA_SECRET_KEY,

                response:
                  token

              }).toString()

          }
        );

      const result =
        await googleResponse.json();

      if (!result.success) {

        console.error(
          "reCAPTCHA FAILED:",
          result
        );

        return res.status(403).json({

          ok: false,

          error:
            "reCAPTCHA verification failed.",

          details:
            result["error-codes"] || []

        });

      }

      res.json({

        ok: true,

        message:
          "reCAPTCHA verified successfully."

      });

    } catch (error) {

      console.error(
        "RECAPTCHA ERROR:",
        error
      );

      res.status(500).json({

        ok: false,

        error:
          "reCAPTCHA verification error.",

        details:
          error.message

      });

    }

  }
);


/*
=========================================================
 PDF UPLOAD API
=========================================================
*/

app.post(
  "/api/upload-pdf",
  async (req, res) => {

    try {

      const pdfBase64 =
        String(
          req.body.pdfBase64 || ""
        ).trim();

      const fileName =
        String(
          req.body.fileName ||
          "Nizhal_Crackers_Order.pdf"
        ).trim();

      if (!pdfBase64) {

        return res.status(400).json({

          ok: false,

          error:
            "PDF data is missing."

        });

      }

      const cleanBase64 =
        pdfBase64.replace(
          /^data:application\/pdf;base64,/i,
          ""
        );

      if (
        cleanBase64.length < 100
      ) {

        return res.status(400).json({

          ok: false,

          error:
            "Invalid PDF data."

        });

      }

      console.log(
        "Uploading PDF:",
        fileName
      );

      const response =
        await fetch(
          GOOGLE_APPS_SCRIPT_URL,
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              Accept:
                "application/json"

            },

            body:
              JSON.stringify({

                action:
                  "uploadPdf",

                pdfBase64:
                  cleanBase64,

                fileName:
                  fileName

              })

          }
        );

      const responseText =
        await response.text();

      let data;

      try {

        data =
          JSON.parse(
            responseText
          );

      } catch {

        data = {
          raw: responseText
        };

      }

      if (!response.ok) {

        throw new Error(
          "Google Apps Script PDF upload failed. HTTP " +
          response.status
        );

      }

      const viewUrl =
        data.viewUrl ||
        data.url ||
        data.fileUrl ||
        data.webViewLink ||
        "";

      const downloadUrl =
        data.downloadUrl ||
        "";

      res.json({

        ok:
          data.ok !== false,

        message:
          data.message ||
          "PDF uploaded successfully.",

        viewUrl:
          viewUrl,

        downloadUrl:
          downloadUrl,

        fileName:
          fileName

      });

    } catch (error) {

      console.error(
        "PDF UPLOAD ERROR:",
        error
      );

      res.status(500).json({

        ok: false,

        error:
          "PDF upload failed.",

        details:
          error.message

      });

    }

  }
);


/*
=========================================================
 ORDER HISTORY API
=========================================================
*/

app.get(
  "/api/order-history",
  async (req, res) => {

    try {

      const phone =
        String(
          req.query.phone || ""
        ).trim();

      if (!phone) {

        return res.status(400).json({

          ok: false,

          error:
            "Mobile number is required.",

          orders: []

        });

      }

      const url =
        GOOGLE_APPS_SCRIPT_URL +
        "?action=getOrderHistory&phone=" +
        encodeURIComponent(phone);

      const response =
        await fetch(
          url,
          {

            method: "GET",

            headers: {
              Accept: "application/json"
            },

            cache: "no-store"

          }
        );

      const text =
        await response.text();

      let data;

      try {

        data =
          JSON.parse(text);

      } catch {

        data = {

          ok: false,

          error:
            "Invalid response from Google Apps Script.",

          raw:
            text

        };

      }

      if (!response.ok) {

        return res.status(502).json({

          ok: false,

          error:
            "Order history service failed.",

          details:
            data

        });

      }

      return res.json(data);

    } catch (error) {

      console.error(
        "ORDER HISTORY ERROR:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          "Could not load order history.",

        details:
          error.message,

        orders: []

      });

    }

  }
);


/*
=========================================================
 ORDER SAVE API
=========================================================
*/

app.post(
  "/api/order",
  async (req, res) => {

    try {

      const order =
        req.body;

      if (!order) {

        return res.status(400).json({

          ok: false,

          error:
            "Order data is missing."

        });

      }

      const response =
        await fetch(
          GOOGLE_APPS_SCRIPT_URL,
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              Accept:
                "application/json"

            },

            body:
              JSON.stringify({

                action:
                  "saveOrder",

                order:
                  order

              })

          }
        );

      const text =
        await response.text();

      let data;

      try {

        data =
          JSON.parse(text);

      } catch {

        data = {
          raw: text
        };

      }

      res.json({

        ok:
          data.ok !== false,

        data:
          data

      });

    } catch (error) {

      console.error(
        "ORDER SAVE ERROR:",
        error
      );

      res.status(500).json({

        ok: false,

        error:
          "Order could not be saved.",

        details:
          error.message

      });

    }

  }
);


/*
=========================================================
 OWNER APP
 SECURITY CHECK
=========================================================
*/

function checkOwnerKey(req, res) {

  const suppliedKey =
    String(
      req.headers["x-owner-key"] ||
      req.query.key ||
      req.body?.key ||
      ""
    ).trim();

  if (!OWNER_APP_KEY) {

    res.status(500).json({

      ok: false,

      error:
        "OWNER_APP_KEY is not configured on the server."

    });

    return false;

  }

  if (
    suppliedKey !==
    OWNER_APP_KEY
  ) {

    res.status(401).json({

      ok: false,

      error:
        "Unauthorized owner access."

    });

    return false;

  }

  return true;

}


/*
=========================================================
 OWNER APP
 GET ORDERS
=========================================================

 Example:

 /api/owner/orders?status=New

=========================================================
*/

app.get(
  "/api/owner/orders",
  async (req, res) => {

    try {

      if (!checkOwnerKey(req, res)) {
        return;
      }

      const status =
        String(
          req.query.status || ""
        ).trim();

      let url =
        GOOGLE_APPS_SCRIPT_URL +
        "?action=getOwnerOrders";

      if (status) {

        url +=
          "&status=" +
          encodeURIComponent(status);

      }

      const response =
        await fetch(
          url,
          {

            method: "GET",

            headers: {

              Accept:
                "application/json",

              "X-Owner-Key":
                OWNER_APP_KEY

            },

            cache:
              "no-store"

          }
        );

      const text =
        await response.text();

      let data;

      try {

        data =
          JSON.parse(text);

      } catch {

        data = {

          ok: false,

          error:
            "Invalid response from Google Apps Script.",

          raw:
            text

        };

      }

      if (!response.ok) {

        return res.status(502).json({

          ok: false,

          error:
            "Owner order service failed.",

          details:
            data

        });

      }

      return res.json(data);

    } catch (error) {

      console.error(
        "OWNER ORDERS ERROR:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          "Could not load owner orders.",

        details:
          error.message,

        orders: []

      });

    }

  }
);


/*
=========================================================
 OWNER APP
 NEW ORDER COUNT
=========================================================
*/

app.get(
  "/api/owner/new-count",
  async (req, res) => {

    try {

      if (!checkOwnerKey(req, res)) {
        return;
      }

      const url =
        GOOGLE_APPS_SCRIPT_URL +
        "?action=getNewOrderCount";

      const response =
        await fetch(
          url,
          {

            method: "GET",

            headers: {

              Accept:
                "application/json",

              "X-Owner-Key":
                OWNER_APP_KEY

            },

            cache:
              "no-store"

          }
        );

      const text =
        await response.text();

      let data;

      try {

        data =
          JSON.parse(text);

      } catch {

        data = {

          ok: false,

          error:
            "Invalid response from Google Apps Script.",

          raw:
            text

        };

      }

      if (!response.ok) {

        return res.status(502).json({

          ok: false,

          error:
            "New order count service failed.",

          details:
            data

        });

      }

      return res.json(data);

    } catch (error) {

      console.error(
        "OWNER COUNT ERROR:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          "Could not get new order count.",

        details:
          error.message

      });

    }

  }
);


/*
=========================================================
 OWNER APP
 UPDATE ORDER STATUS
=========================================================
*/

app.post(
  "/api/owner/order-status",
  async (req, res) => {

    try {

      if (!checkOwnerKey(req, res)) {
        return;
      }

      const orderId =
        String(
          req.body.orderId || ""
        ).trim();

      const status =
        String(
          req.body.status || ""
        ).trim();

      if (!orderId) {

        return res.status(400).json({

          ok: false,

          error:
            "Order ID is required."

        });

      }

      if (!status) {

        return res.status(400).json({

          ok: false,

          error:
            "Order status is required."

        });

      }

      const allowedStatuses = [

        "New",

        "Confirmed",

        "Preparing",

        "Delivered",

        "Cancelled"

      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {

        return res.status(400).json({

          ok: false,

          error:
            "Invalid order status.",

          allowedStatuses:
            allowedStatuses

        });

      }

      const response =
        await fetch(
          GOOGLE_APPS_SCRIPT_URL,
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              Accept:
                "application/json"

            },

            body:
              JSON.stringify({

                action:
                  "updateOrderStatus",

                key:
                  OWNER_APP_KEY,

                orderId:
                  orderId,

                status:
                  status

              })

          }
        );

      const text =
        await response.text();

      let data;

      try {

        data =
          JSON.parse(text);

      } catch {

        data = {

          ok: false,

          error:
            "Invalid response from Google Apps Script.",

          raw:
            text

        };

      }

      if (!response.ok) {

        return res.status(502).json({

          ok: false,

          error:
            "Order status service failed.",

          details:
            data

        });

      }

      return res.json(data);

    } catch (error) {

      console.error(
        "OWNER STATUS ERROR:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          "Could not update order status.",

        details:
          error.message

      });

    }

  }
);


/*
=========================================================
 OWNER APP HEALTH
=========================================================
*/

app.get(
  "/api/owner/health",
  (req, res) => {

    if (!checkOwnerKey(req, res)) {
      return;
    }

    res.json({

      ok: true,

      service:
        "Nizhal Crackers Owner API",

      message:
        "Owner API is working."

    });

  }
);


/*
=========================================================
 404 API RESPONSE
=========================================================
*/

app.use(
  "/api",
  (req, res) => {

    res.status(404).json({

      ok: false,

      error:
        "API endpoint not found."

    });

  }
);


/*
=========================================================
 FRONTEND FALLBACK
=========================================================
*/

app.get(
  /.*/,
  (req, res) => {

    res.sendFile(
      path.join(
        publicPath,
        "index.html"
      )
    );

  }
);


/*
=========================================================
 SITEMAP
=========================================================
*/

app.get(
  "/sitemap.xml",
  (req, res) => {

    res.header(
      "Content-Type",
      "application/xml"
    );

    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://nizhalcrackers.online/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);

  }
);


/*
=========================================================
 START SERVER
=========================================================
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "======================================"
    );

    console.log(
      " NIZHAL CRACKERS SERVER"
    );

    console.log(
      "======================================"
    );

    console.log(
      "Server running on port:",
      PORT
    );

    console.log(
      "Frontend:",
      publicPath
    );

    console.log(
      "Products API:",
      "/api/products"
    );

    console.log(
      "PDF Upload API:",
      "/api/upload-pdf"
    );

    console.log(
      "reCAPTCHA API:",
      "/api/verify-recaptcha"
    );

    console.log(
      "Order API:",
      "/api/order"
    );

    console.log(
      "Order History API:",
      "/api/order-history"
    );

    console.log(
      "Owner Orders API:",
      "/api/owner/orders"
    );

    console.log(
      "Owner New Count API:",
      "/api/owner/new-count"
    );

    console.log(
      "Owner Status API:",
      "/api/owner/order-status"
    );

    console.log(
      "Owner Health API:",
      "/api/owner/health"
    );

    console.log(
      "======================================"
    );

  }
);
