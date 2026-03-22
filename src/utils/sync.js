export async function syncToGithub(snapshot) {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 900);
  });

  return {
    ok: true,
    lastSyncAt: new Date().toISOString(),
    message: `Lokaler Platzhalter-Sync für ${snapshot.workouts.length} Workouts abgeschlossen.`,
  };
}
