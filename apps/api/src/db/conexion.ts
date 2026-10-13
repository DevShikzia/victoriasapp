import mongoose from 'mongoose';

/** Conecta a MongoDB (falla el arranque si no puede). */
export async function conectarMongo(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
}

/** Cierra la conexión (para tests y apagado ordenado). */
export async function desconectarMongo(): Promise<void> {
  await mongoose.disconnect();
}
