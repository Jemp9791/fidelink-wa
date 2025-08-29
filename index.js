const express = require('express');
const qrcode = require('qrcode');            // ← librería para generar imagen
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use(express.json());

const TOKEN = process.env.TOKEN;

let latestQR = ''; // guardamos el último QR recibido

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
  latestQR = qr;
  console.log('QR generado (también disponible en /qr)');
});

client.on('ready', () => console.log('WhatsApp listo ✅'));
client.on('disconnected', reason => console.log('WhatsApp desconectado ❌', reason));

client.initialize();

// Webhook que llamará tu Google Sheet
app.post('/send', async (req, res) => {
  try {
    const { token, phone, message } = req.body || {};
    if (!token || token !== TOKEN) return res.status(403).json({ error: 'forbidden' });
    if (!phone || !message) return res.status(400).json({ error: 'missing params' });
    const jid = `${String(phone).replace(/[^\d]/g, '')}@c.us`;
    await client.sendMessage(jid, message);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'send failed' });
  }
});

// >>> Ruta para ver el QR como IMAGEN
app.get('/qr', async (_req, res) => {
  if (!latestQR) return res.send('Esperando que se genere el QR...');
  const dataUrl = await qrcode.toDataURL(latestQR);
  res.send(`
    <html><body style="text-align:center;font-family:sans-serif">
      <h2>Escaneá este QR con WhatsApp</h2>
      <img src="${dataUrl}" style="width:320px;height:320px"/>
    </body></html>
  `);
});

app.get('/', (_req, res) => res.send('FideLink WA bridge activo'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('HTTP on ' + PORT));
