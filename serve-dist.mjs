import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import http from 'node:http';

const FIXED_HOST = '127.0.0.1';
const FIXED_PORT = 4175;
const SERVER_PROTOCOL = 'gym-tracker-dist-v2';
const STATUS_PATH = '/.well-known/gym-tracker-server';

const portArgIndex = process.argv.indexOf('--port');
const requestedPort =
  portArgIndex > -1 ? Number(process.argv[portArgIndex + 1]) : FIXED_PORT;

if (!Number.isInteger(requestedPort) || requestedPort !== FIXED_PORT) {
  process.stderr.write(
    `HardGainWAF verwendet fest http://${FIXED_HOST}:${FIXED_PORT}. ` +
      'Ein anderer Port ist nicht erlaubt.\n',
  );
  process.exit(1);
}

const appRoot = resolve(process.cwd());
const configuredBaseDir = resolve(appRoot, 'dist');

if (!existsSync(configuredBaseDir)) {
  process.stderr.write(
    `Build-Verzeichnis nicht gefunden: ${configuredBaseDir}\n` +
      'Bitte zuerst "npm run build" ausfuehren.\n',
  );
  process.exit(1);
}

const baseDir = realpathSync(configuredBaseDir);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendText(request, response, statusCode, message, extraHeaders = {}) {
  const body = Buffer.from(message);
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });

  response.end(request.method === 'HEAD' ? undefined : body);
}

function isInsideBaseDir(filePath) {
  const relativePath = relative(baseDir, filePath);
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}

function decodeRequestPath(requestUrl) {
  if (typeof requestUrl !== 'string' || !requestUrl.startsWith('/')) {
    return { error: 400 };
  }

  const queryStart = requestUrl.indexOf('?');
  const rawPath = queryStart === -1 ? requestUrl : requestUrl.slice(0, queryStart);
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return { error: 400 };
  }

  // Backslashes are path separators on Windows and must be validated like slashes.
  decodedPath = decodedPath.replaceAll('\\', '/');

  if (
    decodedPath.includes('\0') ||
    decodedPath.split('/').some((segment) => segment === '..')
  ) {
    return { error: 403 };
  }

  return { path: decodedPath };
}

function findFile(relativeRequestPath) {
  const candidate = resolve(baseDir, relativeRequestPath);

  if (!isInsideBaseDir(candidate)) {
    return { forbidden: true };
  }

  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    return { filePath: null };
  }

  // Keep symlinks or junctions inside dist from escaping the document root.
  const realFilePath = realpathSync(candidate);
  if (!isInsideBaseDir(realFilePath)) {
    return { forbidden: true };
  }

  return { filePath: realFilePath };
}

function sendFile(request, response, filePath) {
  const fileStats = statSync(filePath);
  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'Content-Length': fileStats.size,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('error', (error) => response.destroy(error));
  stream.pipe(response);
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(request, response, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    return;
  }

  const decoded = decodeRequestPath(request.url);
  if (decoded.error === 400) {
    sendText(request, response, 400, 'Bad request');
    return;
  }

  if (decoded.error === 403) {
    sendText(request, response, 403, 'Forbidden');
    return;
  }

  if (decoded.path === STATUS_PATH) {
    const body = JSON.stringify({
      protocol: SERVER_PROTOCOL,
      pid: process.pid,
      root: appRoot,
      origin: `http://${FIXED_HOST}:${FIXED_PORT}`,
    });

    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
    return;
  }

  const relativeRequestPath = decoded.path.replace(/^\/+/, '');
  const requestedFile = findFile(relativeRequestPath || 'index.html');

  if (requestedFile.forbidden) {
    sendText(request, response, 403, 'Forbidden');
    return;
  }

  if (requestedFile.filePath) {
    sendFile(request, response, requestedFile.filePath);
    return;
  }

  // Paths with a filename extension are assets, never client-side routes.
  if (extname(relativeRequestPath) !== '') {
    sendText(request, response, 404, 'Not found');
    return;
  }

  const fallbackFile = findFile('index.html');
  if (fallbackFile.forbidden) {
    sendText(request, response, 403, 'Forbidden');
    return;
  }

  if (!fallbackFile.filePath) {
    sendText(request, response, 404, 'Not found');
    return;
  }

  sendFile(request, response, fallbackFile.filePath);
});

server.once('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    process.stderr.write(
      `Port ${FIXED_PORT} ist bereits belegt. ` +
        `HardGainWAF benoetigt fest http://${FIXED_HOST}:${FIXED_PORT}.\n`,
    );
  } else {
    process.stderr.write(`HardGainWAF Serverfehler: ${error.message}\n`);
  }

  process.exitCode = 1;
});

server.listen(FIXED_PORT, FIXED_HOST, () => {
  process.stdout.write(
    `HardGainWAF server running at http://${FIXED_HOST}:${FIXED_PORT}\n`,
  );
});
