console.log('MOH AKBAR NUSANTARA        || F5512520037');
console.log('CUT SAFIRA                 || F5512510022');
console.log('ANDHIN ANGGRAINI BANTULU   || F5512510010');
console.log('BAGUS ALDY PUTRA           || F5512510009');
console.log('HUMAIRA ISLAMI RISYA ADAM  || F5512510006');
const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = 4000;
const DATA_FILE = path.join(__dirname, 'data', 'produk.json');

// ---------- helper respons ----------
function kirimJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function kirimError(res, statusCode, pesan) {
  kirimJSON(res, statusCode, { error: pesan });
}

// ---------- helper data ----------
async function bacaData() {
  const isi = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(isi);
}

async function simpanData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---------- helper request & validasi ----------
const FIELD_WAJIB = ['nama', 'kategori', 'harga', 'stok'];

function buatError(statusCode, pesan) {
  const err = new Error(pesan);
  err.statusCode = statusCode;
  return err;
}

function bacaBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (body === '') return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(buatError(400, 'Body request bukan JSON yang valid'));
      }
    });
    req.on('error', reject);
  });
}

function cekFieldWajib(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return FIELD_WAJIB;
  }
  return FIELD_WAJIB.filter((field) => {
    const val = input[field];
    if (typeof val === 'string') return val.trim() === '';
    if (typeof val === 'number') return isNaN(val);
    return val === undefined || val === null;
  });
}

// ---------- handler ----------
async function daftarProduk(req, res, url) {
  let data = await bacaData();
  const kategori = url.searchParams.get('kategori');
  const nama = url.searchParams.get('nama');

  if (kategori) {
    data = data.filter((item) => item.kategori.toLowerCase() === kategori.toLowerCase());
  }
  if (nama) {
    data = data.filter((item) => item.nama.toLowerCase().includes(nama.toLowerCase()));
  }

  kirimJSON(res, 200, data);
}

async function detailProduk(req, res, id) {
  const data = await bacaData();
  const item = data.find((d) => d.id === id);
  if (!item) {
    return kirimError(res, 404, `Produk dengan id ${id} tidak ditemukan`);
  }
  kirimJSON(res, 200, item);
}

async function tambahProduk(req, res) {
  const input = await bacaBody(req);
  const kurang = cekFieldWajib(input);
  if (kurang.length > 0) {
    return kirimError(res, 400, `Field wajib belum diisi: ${kurang.join(', ')}`);
  }

  const data = await bacaData();
  const idBaru = data.length === 0 ? 1 : Math.max(...data.map((d) => d.id)) + 1;
  
  const item = {
    id: idBaru,
    nama: String(input.nama).trim(),
    kategori: String(input.kategori).trim(),
    harga: Number(input.harga),
    stok: Number(input.stok)
  };

  data.push(item);
  await simpanData(data);

  res.setHeader('Location', `/produk/${idBaru}`);
  kirimJSON(res, 201, item);
}

async function ubahProduk(req, res, id) {
  const input = await bacaBody(req);
  const data = await bacaData();
  const index = data.findIndex((d) => d.id === id);
  if (index === -1) {
    return kirimError(res, 404, `Produk dengan id ${id} tidak ditemukan`);
  }

  const kurang = cekFieldWajib(input);
  if (kurang.length > 0) {
    return kirimError(res, 400, `Field wajib belum diisi: ${kurang.join(', ')}`);
  }

  data[index] = {
    id,
    nama: String(input.nama).trim(),
    kategori: String(input.kategori).trim(),
    harga: Number(input.harga),
    stok: Number(input.stok)
  };

  await simpanData(data);
  kirimJSON(res, 200, data[index]);
}

async function hapusProduk(req, res, id) {
  const data = await bacaData();
  const index = data.findIndex((d) => d.id === id);
  if (index === -1) {
    return kirimError(res, 404, `Produk dengan id ${id} tidak ditemukan`);
  }

  data.splice(index, 1);
  await simpanData(data);
  res.writeHead(204);
  res.end();
}

// ---------- router ----------
async function router(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const segmen = url.pathname.split('/').filter(Boolean);

  if (segmen[0] !== 'produk' || segmen.length > 2) {
    return kirimError(res, 404, 'Endpoint tidak ditemukan');
  }

  // Endpoint koleksi: /produk
  if (segmen.length === 1) {
    if (req.method === 'GET') return daftarProduk(req, res, url);
    if (req.method === 'POST') return tambahProduk(req, res);
    res.setHeader('Allow', 'GET, POST');
    return kirimError(res, 405, `Method ${req.method} tidak didukung pada endpoint ini`);
  }

  // Endpoint item: /produk/:id
  const id = Number(segmen[1]);
  if (!Number.isInteger(id) || id < 1) {
    return kirimError(res, 400, 'id harus berupa bilangan bulat positif');
  }

  if (req.method === 'GET') return detailProduk(req, res, id);
  if (req.method === 'PUT') return ubahProduk(req, res, id);
  if (req.method === 'DELETE') return hapusProduk(req, res, id);
  res.setHeader('Allow', 'GET, PUT, DELETE');
  return kirimError(res, 405, `Method ${req.method} tidak didukung pada endpoint ini`);
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  try {
    await router(req, res);
  } catch (err) {
    if (err.statusCode) {
      return kirimError(res, err.statusCode, err.message);
    }
    console.error(err);
    kirimError(res, 500, 'Terjadi kesalahan pada server');
  }
});

server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});