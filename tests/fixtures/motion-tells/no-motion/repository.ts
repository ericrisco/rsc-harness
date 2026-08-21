export async function findUser(id: string) {
  const row = await db.query('select * from users where id = $1', [id]);
  return row ?? null;
}
