// Be a Beast – password reset page (Supabase Auth, implicit flow).
(function () {
  'use strict';

  var SUPABASE_URL = 'https://zwbaziqhcgikylvqmqrf.supabase.co';
  // Publishable key: public by design. Never put the secret key or DB password here.
  var SUPABASE_PUBLISHABLE_KEY = 'PASTE_PUBLISHABLE_KEY_HERE';
  // Must match exactly, and must be listed in Supabase → Authentication → URL Configuration → Redirect URLs.
  var REDIRECT_URL = 'https://www.jirisestak.com/beabeast/resetPassword/';

  var $ = function (id) { return document.getElementById(id); };
  var VIEWS = ['view-loading', 'view-request', 'view-sent', 'view-new', 'view-done'];

  function show(id) {
    VIEWS.forEach(function (v) { $(v).hidden = v !== id; });
    var first = $(id).querySelector('input:not([hidden]), a');
    if (first && id !== 'view-loading') first.focus({ preventScroll: true });
  }
  function notice(text, isError) {
    var n = $('notice');
    n.textContent = text || '';
    n.hidden = !text;
    n.className = 'notice' + (isError ? ' error' : '');
  }
  function fieldError(id, text) {
    $(id).textContent = text || '';
    $(id).hidden = !text;
  }
  function cleanUrl() {
    history.replaceState(null, '', location.pathname);
  }

  // Read what the email link put in the URL before supabase-js consumes it.
  var hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  var query = new URLSearchParams(location.search);
  var urlError = hash.get('error') || query.get('error');
  var urlErrorCode = hash.get('error_code') || query.get('error_code');
  var isRecoveryLink = hash.get('type') === 'recovery' && hash.has('access_token');

  if (SUPABASE_PUBLISHABLE_KEY.indexOf('PASTE_') === 0 || !window.supabase) {
    notice('This page is not configured yet. Please try again later.', true);
    show('view-request');
    $('form-request').querySelector('button').disabled = true;
    return;
  }

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      flowType: 'implicit',
      detectSessionInUrl: !urlError,
      persistSession: false,
      autoRefreshToken: true
    }
  });

  var inRecovery = false;
  client.auth.onAuthStateChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY') {
      inRecovery = true;
      cleanUrl();
      $('username').value = (session && session.user && session.user.email) || '';
      notice('');
      show('view-new');
    }
  });

  function showExpired() {
    cleanUrl();
    notice('This reset link has expired or was already used. Enter your email to get a new one.', true);
    show('view-request');
  }

  if (urlError) {
    // e.g. #error=access_denied&error_code=otp_expired
    if (urlErrorCode === 'otp_expired' || urlError === 'access_denied') {
      showExpired();
    } else {
      cleanUrl();
      notice('This reset link is not valid. Enter your email to get a new one.', true);
      show('view-request');
    }
  } else {
    // Wait for supabase-js to finish reading the URL.
    client.auth.getSession().then(function () {
      if (inRecovery) return;
      if (isRecoveryLink) showExpired(); // link was in the URL but could not be used
      else show('view-request');
    }, function () {
      if (!inRecovery) (isRecoveryLink ? showExpired : function () { show('view-request'); })();
    });
  }

  // A) Request a reset link
  $('form-request').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldError('request-error', 'Please enter a valid email address.');
      return;
    }
    fieldError('request-error', '');
    var btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    client.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT_URL })
      .catch(function () { /* never reveal whether the account exists */ })
      .then(function () {
        notice('');
        show('view-sent');
        btn.disabled = false;
        btn.textContent = 'Send reset link';
      });
  });

  $('link-again').addEventListener('click', function (e) {
    e.preventDefault();
    notice('');
    show('view-request');
  });

  // B) Set the new password
  $('show').addEventListener('change', function (e) {
    var t = e.target.checked ? 'text' : 'password';
    $('password').type = t;
    $('password2').type = t;
  });

  $('form-new').addEventListener('submit', function (e) {
    e.preventDefault();
    var p1 = $('password').value;
    var p2 = $('password2').value;
    if (p1.length < 8) { fieldError('new-error', 'The password must be at least 8 characters.'); return; }
    if (p1 !== p2) { fieldError('new-error', "The passwords don't match."); return; }
    fieldError('new-error', '');

    var btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    client.auth.updateUser({ password: p1 }).then(function (res) {
      if (res.error) throw res.error;
      return client.auth.signOut().catch(function () {});
    }).then(function () {
      $('password').value = '';
      $('password2').value = '';
      show('view-done');
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = 'Change password';
      var name = (err && err.name) || '';
      if (name === 'AuthSessionMissingError' || (err && err.status === 401)) {
        showExpired();
        return;
      }
      fieldError('new-error', (err && err.message) || 'Something went wrong. Please try again.');
    });
  });
})();
