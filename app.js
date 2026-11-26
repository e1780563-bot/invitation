const bookingView = document.querySelector('#bookingView');
const hostView = document.querySelector('#hostView');
const hostToggle = document.querySelector('#hostToggle');
const hostToggleLabel = document.querySelector('#hostToggleLabel');
const bookingForm = document.querySelector('#bookingForm');
const formMessage = document.querySelector('#formMessage');
const venueField = document.querySelector('#venueField');
const reservationList = document.querySelector('#reservationList');
const toast = document.querySelector('#toast');
const dateInput = document.querySelector('#date');
let eventSource;
let toastTimer;

dateInput.min = new Date().toLocaleDateString('en-CA');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3600);
}

function setView(showHost) {
  bookingView.classList.toggle('hidden', showHost);
  hostView.classList.toggle('hidden', !showHost);
  hostToggleLabel.textContent = showHost ? 'Voir l’invitation' : 'Espace de l’hôte';
  if (showHost) {
    loadReservations();
    connectEvents();
  }
}

hostToggle.addEventListener('click', () => setView(hostView.classList.contains('hidden')));
document.querySelector('#backToInvite').addEventListener('click', () => setView(false));

document.querySelectorAll('input[name="location"]').forEach((input) => {
  input.addEventListener('change', () => {
    venueField.classList.toggle('hidden', document.querySelector('input[name="location"]:checked').value !== 'restaurant');
  });
});

bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formMessage.textContent = '';
  formMessage.classList.remove('error');
  const data = new FormData(bookingForm);
  const dishes = data.getAll('dishes').map((dish) => dish.toString());
  const otherDish = document.querySelector('#otherDish').value.trim();
  if (otherDish) dishes.push(otherDish);
  if (!dishes.length) {
    formMessage.textContent = 'Choisis au moins un plat pour le dîner.';
    formMessage.classList.add('error');
    return;
  }

  const payload = {
    date: data.get('date'),
    time: data.get('time'),
    location: data.get('location'),
    venue: data.get('venue'),
    dishes,
    dessert: data.get('dessert'),
    note: data.get('note'),
    giftType: data.get('giftType'),
    giftDetails: data.get('giftDetails'),
  };

  const submitButton = bookingForm.querySelector('.submit-button');
  submitButton.disabled = true;
  submitButton.querySelector('span:first-child').textContent = 'Envoi en cours…';
  try {
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'La demande n’a pas pu être envoyée.');
    bookingForm.reset();
    venueField.classList.add('hidden');
    dateInput.min = new Date().toLocaleDateString('en-CA');
    formMessage.textContent = 'Ton invitation est bien arrivée. J’ai hâte de te retrouver ! ♡';
    showToast('Ton invitation a été envoyée ♡');
  } catch (error) {
    formMessage.textContent = error.message || 'Impossible d’envoyer la demande. Réessaie dans un instant.';
    formMessage.classList.add('error');
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span:first-child').textContent = 'Envoyer mon invitation';
  }
});

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`));
}

function renderReservations(reservations) {
  if (!reservations.length) {
    reservationList.innerHTML = '<div class="empty-state"><span class="empty-heart">♡</span>Pas encore d’invitation. Acho prépare peut-être déjà la prochaine soirée…</div>';
    return;
  }

  reservationList.innerHTML = reservations.map((booking) => {
    const statusName = { pending: 'À confirmer', confirmed: 'Confirmé ♡', declined: 'À reprogrammer' }[booking.status] || 'À confirmer';
    const statusClass = { pending: '', confirmed: 'confirmed', declined: 'declined' }[booking.status] || '';
    const location = booking.location === 'restaurant'
      ? `Au restaurant${booking.venue ? ` · ${escapeHtml(booking.venue)}` : ''}`
      : 'À la résidence';
    const dishes = (booking.dishes || []).map(escapeHtml).join(', ');
    const dessert = booking.dessert ? `<div><span class="meta-label">Dessert</span><span class="meta-value">${escapeHtml(booking.dessert)}</span></div>` : '';
    const note = booking.note ? `<div class="card-note">« ${escapeHtml(booking.note)} »</div>` : '';
    const giftDetails = booking.giftDetails ? ` — ${escapeHtml(booking.giftDetails)}` : '';
    const actions = booking.status === 'pending'
      ? `<div class="card-actions"><button type="button" data-status="declined" data-id="${escapeHtml(booking.id)}">Proposer une autre date</button><button type="button" class="confirm-action" data-status="confirmed" data-id="${escapeHtml(booking.id)}">Confirmer le dîner</button></div>`
      : '';

    return `<article class="reservation-card ${statusClass ? `card-${statusClass}` : ''}">
      <div class="card-top"><div><div class="card-date">${escapeHtml(formatDate(booking.date))}</div><div class="card-time">${escapeHtml(booking.time)}</div></div><span class="status-pill ${statusClass}">${statusName}</span></div>
      <div class="card-meta"><div><span class="meta-label">Où ?</span><span class="meta-value">${location}</span></div><div><span class="meta-label">Au menu</span><span class="meta-value">${dishes}</span></div>${dessert}</div>
      <div class="card-gift"><strong>Anniversaire :</strong> ${escapeHtml(booking.giftType)}${giftDetails}</div>${note}${actions}</article>`;
  }).join('');

  reservationList.querySelectorAll('[data-status]').forEach((button) => {
    button.addEventListener('click', () => updateStatus(button.dataset.id, button.dataset.status));
  });
}

async function loadReservations() {
  try {
    const response = await fetch('/api/reservations');
    if (!response.ok) throw new Error('Chargement impossible');
    renderReservations(await response.json());
  } catch {
    reservationList.innerHTML = '<div class="empty-state">Impossible de charger les invitations. Vérifie que l’application est bien lancée.</div>';
  }
}

async function updateStatus(id, status) {
  try {
    const response = await fetch(`/api/reservations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'La réponse n’a pas été enregistrée.');
    await loadReservations();
    showToast(status === 'confirmed' ? 'Le dîner est confirmé ♡' : 'Tu lui as proposé une autre date.');
  } catch (error) {
    showToast(error.message || 'Impossible d’enregistrer la réponse.');
  }
}

function connectEvents() {
  if (eventSource) return;
  eventSource = new EventSource('/api/events');
  eventSource.addEventListener('reservation', (event) => {
    const booking = JSON.parse(event.data);
    loadReservations();
    showToast('Nouvelle invitation d’Acho ♡');
    if ('Notification' in window && Notification.permission === 'granted') {
      const location = booking.location === 'restaurant' ? 'au restaurant' : 'à la résidence';
      new Notification('Une invitation à dîner ♡', {
        body: `Acho te propose un dîner ${location} le ${formatDate(booking.date)} à ${booking.time}.`,
        tag: booking.id,
      });
    }
  });
  eventSource.addEventListener('updated', () => loadReservations());
}

document.querySelector('#notifyButton').addEventListener('click', async () => {
  if (!('Notification' in window) || !window.isSecureContext) {
    showToast('Pour activer les alertes, ouvre cette application sur localhost ou en HTTPS.');
    return;
  }
  if (Notification.permission === 'granted') {
    showToast('Les alertes sont déjà activées sur cet appareil.');
    return;
  }
  const hint = document.querySelector('#notificationHint');
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      hint.textContent = 'Les alertes sont activées. Garde cette page ouverte pour recevoir les prochaines invitations.';
      showToast('Les alertes sont activées ♡');
    } else {
      hint.textContent = 'Le navigateur n’a pas autorisé les alertes. Les demandes apparaîtront ici lorsque cette page est ouverte.';
    }
  } catch {
    hint.textContent = 'Les alertes ne sont pas disponibles dans ce navigateur. Les demandes apparaîtront ici lorsque cette page est ouverte.';
  }
});
