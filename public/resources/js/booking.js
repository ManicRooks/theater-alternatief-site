// Set this to your Google Apps Script deployment URL after deploying Code.gs
// Leave empty to use static data.json (booking buttons will be disabled)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyw_5SZa0ES7GgBQnmi92JPy4af7EtAifdYC-LiBA0YjZRExW1uuWkRuzpV2MtZr2w4jQ/exec';

function formatDate(isoDate) {
  var d = new Date(isoDate + 'T12:00:00');
  var s = d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

document.addEventListener('DOMContentLoaded', function () {
  var targetElement = document.querySelector('#voorstellingen');
  if (!targetElement) return;

  var observer = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        loadBooking(function (data) { setBookingdata(targetElement, data); });
        obs.unobserve(entry.target);
      }
    });
  }, { root: null, threshold: 0.5 });

  observer.observe(targetElement);

  document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
});

function loadBooking(callback) {
  var url = APPS_SCRIPT_URL || '/resources/data.json';
  fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error('Network response was not ok');
      return r.json();
    })
    .then(callback)
    .catch(function (error) {
      console.error('Error loading booking data:', error);
      if (APPS_SCRIPT_URL) {
        fetch('/resources/data.json').then(function (r) { return r.json(); }).then(callback).catch(function () {});
      }
    });
}

function setBookingdata(targetElement, data) {
  if (data.leadtext)
    targetElement.querySelector('.container-lead-text').innerHTML = data.leadtext;

  var shows = targetElement.querySelector('.container-shows');
  var template = document.querySelector('#showrow');

  Object.entries(data.performances).forEach(function (entry) {
    var dateKey = entry[0], status = entry[1];
    var displayDate = formatDate(dateKey);
    var clone = template.content.cloneNode(true);
    var span = clone.querySelector('span');
    var button = clone.querySelector('button');
    span.textContent = displayDate;

    if (status === 'STATUS_INACTIVE' || status === 'STATUS_ONLINE_RESERVATION_CLOSED') {
      button.remove();
    } else if (status === 'STATUS_LIMITED') {
      button.classList.add('btn-res-limited');
      button.textContent = 'Laatste plaatsen';
      button.addEventListener('click', function () { openBookingModal(dateKey); });
    } else if (status === 'STATUS_SOLDOUT') {
      button.classList.add('btn-res-soldout');
      button.textContent = 'Uitverkocht';
      button.disabled = true;
    } else {
      button.textContent = 'Reserveren';
      button.addEventListener('click', function () { openBookingModal(dateKey); });
    }

    shows.appendChild(clone);
  });

  var spinner = shows.querySelector('.spinner');
  if (spinner) spinner.remove();
}

function openBookingModal(dateKey) {
  var form = document.getElementById('booking-form');
  form.reset();
  form.classList.remove('was-validated');
  document.getElementById('bookingDate').value = dateKey;
  document.getElementById('modal-selected-date').textContent = formatDate(dateKey);
  document.getElementById('booking-form-container').style.display = '';
  document.getElementById('booking-confirmation').style.display = 'none';
  document.getElementById('booking-error').style.display = 'none';

  new bootstrap.Modal(document.getElementById('bookingModal')).show();
}

function handleBookingSubmit(e) {
  e.preventDefault();
  var form = e.target;

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  if (!APPS_SCRIPT_URL) {
    showError('Reservatie is momenteel niet beschikbaar.');
    return;
  }

  var submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Even geduld...';
  document.getElementById('booking-error').style.display = 'none';

  var data = {
    name: document.getElementById('bookingName').value.trim(),
    email: document.getElementById('bookingEmail').value.trim(),
    bookingDate: document.getElementById('bookingDate').value,
    bookingSeats: document.getElementById('bookingSeats').value,
    remarks: document.getElementById('bookingRemarks').value.trim(),
    newsletter: document.getElementById('bookingNewsletter').checked
  };

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'text/plain' }
  })
    .then(function (r) { return r.json(); })
    .then(function (result) {
      if (result.success) {
        showConfirmation(result);
      } else {
        showError(result.error || 'Er ging iets mis bij het verwerken van uw reservatie.');
      }
    })
    .catch(function () {
      showError('Er ging iets mis. Probeer het later opnieuw of contacteer ons via reservatie@theateralternatief.be.');
    })
    .finally(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Nu reserveren';
    });
}

function showConfirmation(result) {
  document.getElementById('booking-form-container').style.display = 'none';
  var conf = document.getElementById('booking-confirmation');
  conf.querySelector('.conf-code').textContent = result.id;
  conf.querySelector('.conf-name').textContent = result.name;
  conf.querySelectorAll('.conf-email').forEach(function (el) { el.textContent = result.email; });
  conf.querySelector('.conf-date').textContent = formatDate(result.bookingDate);
  conf.querySelector('.conf-seats').textContent = result.bookingSeats;
  conf.querySelector('.conf-remarks').textContent = result.remarks || '-';
  conf.style.display = '';
}

function showError(message) {
  var el = document.getElementById('booking-error');
  el.textContent = message;
  el.style.display = '';
}
