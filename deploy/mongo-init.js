// Crea un usuario de aplicación con permisos solo sobre la base de MatiApp.
// Se ejecuta una única vez, al inicializar el volumen de MongoDB.

const dbName = process.env.MONGO_DB;
const user = process.env.MONGO_APP_USER;
const pwd = process.env.MONGO_APP_PASSWORD;

if (!dbName || !user || !pwd) {
  throw new Error('Faltan MONGO_DB, MONGO_APP_USER o MONGO_APP_PASSWORD');
}

db.getSiblingDB(dbName).createUser({
  user,
  pwd,
  roles: [{ role: 'readWrite', db: dbName }],
});
