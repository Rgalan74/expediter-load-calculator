/**
 * calculator-notes.js
 * Destination notes management system
 * Extracted from calculator.js for lazy loading
 * Version: 1.0.0
 */

// ========================================
// NOTES FUNCTIONS
// ========================================

let currentDestinationKey = '';

/**
 * Normalize destination string
 */
function normalizeDestination(value) {
    if (!value) return '';
    return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Get notes for a destination
 */
async function getNotesForDestination(normalizedKey) {
    if (!window.currentUser) {
        console.warn('User not authenticated');
        return { empty: true, docs: [] };
    }

    try {
        const snapshot = await firebase.firestore()
            .collection("notes")
            .where("userId", "==", window.currentUser.uid)
            .get();

        const filteredDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            const keyNorm = normalizeDestination(data.key || "");
            const destNorm = normalizeDestination(data.destination || "");
            return keyNorm === normalizedKey || destNorm === normalizedKey;
        });

        return {
            empty: filteredDocs.length === 0,
            docs: filteredDocs
        };
    } catch (error) {
        console.error('Error getting notes:', error);
        return { empty: true, docs: [] };
    }
}

/**
 * Show destination notes (quick info box)
 */
async function showDestinationNotes(destination) {
    if (!destination) return;

    const normalized = normalizeDestination(destination);

    if (typeof window.debugLog === 'function') {
        window.debugLog("📝 showDestinationNotes:", destination, "→", normalized);
    }

    const snapshot = await firebase.firestore()
        .collection("notes")
        .where("userId", "==", window.currentUser.uid)
        .get();

    const notes = snapshot.docs.filter(doc => {
        const data = doc.data();
        const keyNorm = normalizeDestination(data.key || "");
        const destNorm = normalizeDestination(data.destination || "");
        return keyNorm === normalized || destNorm === normalized;
    });

    const box = document.getElementById("previousNoteBox");
    const status = document.getElementById("notesStatusText");

    if (notes.length > 0) {
        status.textContent = `📝 Tienes ${notes.length} nota(s) guardada(s) para este destino`;
        box.classList.remove("hidden");
    } else {
        status.textContent = "ℹ️ No hay notas para este destino todavía.";
        box.classList.remove("hidden");
    }
}

/**
 * Open notes modal
 */
async function openNotesModal(destination) {
    currentDestinationKey = normalizeDestination(destination);

    const modal = document.getElementById("notesModal");
    const title = document.getElementById("notesModalTitle");
    const list = document.getElementById("notesListModal");

    if (!currentDestinationKey) {
        title.textContent = "Notas";
        list.innerHTML = `<p class="text-gray-500 text-sm">No se especificó un destino.</p>`;
        modal.classList.remove("hidden");
        modal.classList.add("flex");
        return;
    }

    title.textContent = `Notas: ${destination}`;

    const result = await getNotesForDestination(currentDestinationKey);

    if (result.empty) {
        list.innerHTML = `<p class="text-gray-500 text-sm">No hay notas para este destino.</p>`;
    } else {
        list.innerHTML = result.docs.map(doc => {
            const data = doc.data();
            return `
        <div class="bg-gray-50 rounded-lg p-3 mb-2">
          <div class="flex justify-between items-start">
            <p class="text-sm flex-1">${data.text || ''}</p>
            <div class="flex gap-2 ml-2">
              <button onclick="editNote('${doc.id}', '${(data.text || '').replace(/'/g, "\\'")})" 
                      class="text-blue-600 hover:text-blue-800 text-xs">
                ✏️ Editar
              </button>
              <button onclick="deleteNote('${doc.id}')" 
                      class=" text-red-600 hover:text-red-800 text-xs">
                🗑️ Borrar
              </button>
            </div>
          </div>
        </div>
      `;
        }).join('');
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

/**
 * Close notes modal
 */
function closeNotesModal() {
    const modal = document.getElementById("notesModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
}

/**
 * Add note to destination
 */
async function addNoteToDestination(key) {
    const input = document.getElementById("newNoteInput");
    const text = input?.value?.trim();

    if (!text) {
        alert("Por favor escribe una nota");
        return;
    }

    if (!window.currentUser) {
        alert("Debes estar autenticado");
        return;
    }

    try {
        await firebase.firestore().collection("notes").add({
            userId: window.currentUser.uid,
            key: key,
            destination: key,
            text: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        input.value = "";

        const destination = document.getElementById('destination')?.value;
        if (destination) {
            await openNotesModal(destination);
        }

        if (typeof window.showToast === 'function') {
            window.showToast('✅ Nota guardada', 'success');
        }
    } catch (error) {
        console.error('Error adding note:', error);
        alert('Error guardando nota');
    }
}

/**
 * Edit note
 */
async function editNote(noteId, oldText) {
    const newText = prompt("Editar nota:", oldText);

    if (newText === null || newText.trim() === "") {
        return;
    }

    try {
        await firebase.firestore().collection("notes").doc(noteId).update({
            text: newText.trim()
        });

        const destination = document.getElementById('destination')?.value;
        if (destination) {
            await openNotesModal(destination);
        }

        if (typeof window.showToast === 'function') {
            window.showToast('✅ Nota actualizada', 'success');
        }
    } catch (error) {
        console.error('Error editing note:', error);
        alert('Error editando nota');
    }
}

/**
 * Delete note
 */
async function deleteNote(noteId) {
    if (!confirm("¿Seguro que quieres eliminar esta nota?")) {
        return;
    }

    try {
        await firebase.firestore().collection("notes").doc(noteId).delete();

        const destination = document.getElementById('destination')?.value;
        if (destination) {
            await openNotesModal(destination);
        }

        if (typeof window.showToast === 'function') {
            window.showToast('✅ Nota eliminada', 'success');
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Error eliminando nota');
    }
}

/**
 * Handle destination change event
 */
function handleDestinationChange(e) {
    const value = e.target.value;
    if (value && value.length > 2) {
        showDestinationNotes(value);
    }
}

// ========================================
// EXPORTS
// ========================================

window.CalculatorNotes = {
    normalizeDestination,
    getNotesForDestination,
    showDestinationNotes,
    openNotesModal,
    closeNotesModal,
    addNoteToDestination,
    editNote,
    deleteNote,
    handleDestinationChange
};

// Individual exports for compatibility
window.normalizeDestination = normalizeDestination;
window.getNotesForDestination = getNotesForDestination;
window.showDestinationNotes = showDestinationNotes;
window.openNotesModal = openNotesModal;
window.closeNotesModal = closeNotesModal;
window.addNoteToDestination = addNoteToDestination;
window.editNote = editNote;
window.deleteNote = deleteNote;
window.handleDestinationChange = handleDestinationChange;

console.log('📦 Calculator Notes module loaded successfully');
