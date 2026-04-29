const QRCode = require("qrcode");
const sharp = require("sharp");

exports.generateTableQRCode = async (tableNo) => {
  try {
    const serviceUrl = process.env.FRONTEND_URL;
    const qrText = `${serviceUrl}/table/${tableNo}`;

    // 1. Generate clean QR
    const qrBuffer = await QRCode.toBuffer(qrText, {
      errorCorrectionLevel: "H",
      width: 500,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    // 2. Create SVG label (table number BELOW QR)
    const labelHeight = 120;

    const svgLabel = `
      <svg width="500" height="${labelHeight}">
        <rect width="100%" height="100%" fill="white"/>
        <text x="50%" y="50%" 
          fill="black" 
          font-size="60" 
          font-weight="bold" 
          text-anchor="middle" 
          dominant-baseline="middle"
          font-family="Arial, sans-serif">
          Table ${tableNo}
        </text>
      </svg>
    `;

    const labelBuffer = Buffer.from(svgLabel);

    // 3. Extend canvas and add label below QR
    const finalImage = await sharp({
      create: {
        width: 500,
        height: 500 + labelHeight,
        channels: 3,
        background: "#ffffff",
      },
    })
      .composite([
        { input: qrBuffer, top: 0, left: 0 },
        { input: labelBuffer, top: 500, left: 0 },
      ])
      .png()
      .toBuffer();

    return finalImage;

  } catch (err) {
    console.error("QR generation failed:", err);
    throw err;
  }
};