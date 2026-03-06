/**
 * backfill-profitpermile.js
 * Migración one-time: añade profitPerMile a cargas antiguas que no lo tienen.
 * Pegar en la consola del browser con el usuario ya autenticado.
 */
(async function backfillProfitPerMile() {
    const uid = window.currentUser?.uid || firebase.auth().currentUser?.uid;
    if (!uid) { console.error('❌ No hay usuario autenticado'); return; }

    console.log('🔄 Iniciando migración profitPerMile para userId:', uid);

    const snapshot = await firebase.firestore()
        .collection('loads')
        .where('userId', '==', uid)
        .get();

    const toUpdate = [];

    snapshot.forEach(doc => {
        const d = doc.data();
        if (d.profitPerMile === undefined || d.profitPerMile === null) {
            const netProfit = Number(d.netProfit || d.profit || 0);
            const totalMiles = Number(d.totalMiles || d.miles || 0);
            const value = totalMiles > 0 ? netProfit / totalMiles : 0;
            toUpdate.push({ ref: doc.ref, value });
        }
    });

    console.log(`📦 ${snapshot.size} cargas totales — ${toUpdate.length} necesitan profitPerMile`);

    if (toUpdate.length === 0) {
        console.log('✅ Nada que migrar.');
        return;
    }

    // Batch en grupos de 500 (límite Firestore)
    const BATCH_SIZE = 500;
    let updated = 0;

    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = firebase.firestore().batch();
        const chunk = toUpdate.slice(i, i + BATCH_SIZE);

        chunk.forEach(({ ref, value }) => {
            batch.update(ref, { profitPerMile: value });
        });

        await batch.commit();
        updated += chunk.length;
        console.log(`✅ Actualizadas ${updated}/${toUpdate.length} cargas...`);
    }

    console.log(`🎉 Migración completa: ${updated} cargas actualizadas con profitPerMile.`);
})();
