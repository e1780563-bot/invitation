const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'reservations.json');
const clients = new Set();
const statuses = new Set(['pending', 'confirmed', 'declined']);

async function readReservations() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const text = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.writeFile(DATA_FILE, '[]\n', 'utf8');
    return [];
  }
}

let writeQueue = Promise.resolve();
function saveReservations(reservations) {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const temp = `${DATA_FILE}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(reservations, null, 2)}\n`, 'utf8');
    await fs.rename(temp, DATA_FILE);
  });
  return writeQueue;
}

function publish(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of clients) response.write(message);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 100_000) throw new Error('La demande est trop volumineuse.');
  }
  return JSON.parse(body || '{}');
}

function cleanText(value, max = 180) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validateBooking(body) {
  const date = cleanText(body.date, 10);
  const time = cleanText(body.time, 5);
  const location = cleanText(body.location, 16);
  const dishes = Array.isArray(body.dishes)
    ? body.dishes.map((dish) => cleanText(dish, 80)).filter(Boolean).slice(0, 12)
    : [];
  const giftType = cleanText(body.giftType, 60);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00`))) {
    return { error: 'Choisis une date valide.' };
  }
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: 'Choisis une heure valide.' };
  if (!['residence', 'restaurant'].includes(location)) return { error: 'Choisis un lieu.' };
  if (!dishes.length) return { error: 'Choisis au moins un plat.' };
  if (!giftType) return { error: 'Choisis un type de cadeau pour ton anniversaire.' };

  return {
    booking: {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      date,
      time,
      location,
      venue: cleanText(body.venue, 120),
      dishes,
      dessert: cleanText(body.dessert, 120),
      note: cleanText(body.note, 500),
      giftType,
      giftDetails: cleanText(body.giftDetails, 300),
    },
  };
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

async function serveStatic(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
    response.writeHead(403);
    response.end('Interdit');
    return;
  }
  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    });
    response.end(file);
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404);
      response.end('Fichier introuvable');
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://localhost');

    if (pathname === '/api/events' && request.method === 'GET') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.write('retry: 5000\n\n');
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }

    if (pathname === '/api/reservations' && request.method === 'GET') {
      const reservations = await readReservations();
      reservations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      sendJson(response, 200, reservations);
      return;
    }

    if (pathname === '/api/reservations' && request.method === 'POST') {
      let body;
      try {
        body = await readBody(request);
      } catch {
        sendJson(response, 400, { error: 'Les informations envoyées sont invalides.' });
        return;
      }
      const result = validateBooking(body);
      if (result.error) {
        sendJson(response, 400, { error: result.error });
        return;
      }
      const reservations = await readReservations();
      reservations.push(result.booking);
      await saveReservations(reservations);
      publish('reservation', result.booking);
      sendJson(response, 201, result.booking);
      return;
    }

    const match = pathname.match(/^\/api\/reservations\/([\w-]+)$/);
    if (match && request.method === 'PATCH') {
      let body;
      try {
        body = await readBody(request);
      } catch {
        sendJson(response, 400, { error: 'La réponse est invalide.' });
        return;
      }
      if (!statuses.has(body.status)) {
        sendJson(response, 400, { error: 'Statut invalide.' });
        return;
      }
      const reservations = await readReservations();
      const booking = reservations.find((entry) => entry.id === match[1]);
      if (!booking) {
        sendJson(response, 404, { error: 'Cette demande est introuvable.' });
        return;
      }
      booking.status = body.status;
      booking.updatedAt = new Date().toISOString();
      await saveReservations(reservations);
      publish('updated', booking);
      sendJson(response, 200, booking);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: 'Une erreur est survenue.' });
    else response.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Application prête sur http://localhost:${PORT}`);
  console.log(`Base locale : ${DATA_FILE}`);
});
