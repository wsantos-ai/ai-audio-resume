// Cria ou atualiza um usuário (não há tela de cadastro).
// Uso: npm run create-user -- email@exemplo.com "Nome Completo" [avaliador|admin]
// Lê as variáveis DB_* de .env.local/.env. A senha é pedida no terminal.
import { createInterface } from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const [email, name, role = 'avaliador'] = process.argv.slice(2);
if (!email || !name || !['avaliador', 'admin'].includes(role)) {
  console.error('Uso: npm run create-user -- email "Nome" [avaliador|admin]');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = (await rl.question('Senha: ')).trim();
rl.close();
if (password.length < 8) {
  console.error('A senha precisa ter ao menos 8 caracteres.');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
});
await conn.query(
  `INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), password_hash = VALUES(password_hash), active = 1`,
  [email.toLowerCase(), name, role, await bcrypt.hash(password, 12)],
);
await conn.end();
console.log(`Usuário ${email} salvo como ${role}.`);
