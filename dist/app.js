/* ==============================
   GreenRoots App — Shared Logic
   Navigation, counters, forms,
   track page (UID-based), community page
============================== */

document.addEventListener("DOMContentLoaded", async function () {
  initNavigation();
  initSmoothScroll();
  await initCounters();
  initRegisterForm();
  initContactForm();
  initTrackPage();
  await initCommunityPage();
});

/* ==============================
   NAVIGATION (mobile menu)
============================== */

function initNavigation() {
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (!navToggle || !navLinks) return;

  navToggle.addEventListener("click", function () {
    navLinks.classList.toggle("open");
    navToggle.classList.toggle("active");
    const expanded = navLinks.classList.contains("open");
    navToggle.setAttribute("aria-expanded", expanded);
  });

  document.querySelectorAll(".nav-links a").forEach(function (link) {
    link.addEventListener("click", function () {
      navLinks.classList.remove("open");
      navToggle.classList.remove("active");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", function (e) {
    if (
      !navLinks.contains(e.target) &&
      !navToggle.contains(e.target) &&
      navLinks.classList.contains("open")
    ) {
      navLinks.classList.remove("open");
      navToggle.classList.remove("active");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

/* ==============================
   SMOOTH SCROLL
============================== */

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

/* ==============================
   DATE HELPERS (date-only, no timezone shift)
============================= */

/* Parse a "YYYY-MM-DD" string as a local date (noon) to avoid
   timezone shifts that change the calendar day. */
function parseDateLocal(dateStr) {
  if (!dateStr) return null;
  var parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/* Calculate days between two dates (date-only, no time component). */
function daysBetween(fromDateStr, toDate) {
  var from = parseDateLocal(fromDateStr);
  if (!from) return null;
  var to;
  if (typeof toDate === "string") {
    to = parseDateLocal(toDate);
  } else {
    to = new Date(toDate);
    to.setHours(12, 0, 0, 0);
  }
  if (!to) return null;
  var diff = to.getTime() - from.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/* Format a date string for display (date-only, no timezone shift). */
function formatDate(dateStr) {
  if (!dateStr) return "";
  var d = parseDateLocal(dateStr);
  if (!d) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* Get today's date as YYYY-MM-DD (local, not UTC). */
function todayStr() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

/* ==============================
   ANIMATED COUNTERS
============================== */

async function fetchStats() {
  try {
    const supabase = await window.getSupabaseClient();
    const [{ count: treeCount }, { count: updateCount }] = await Promise.all([
      supabase.from("trees").select("*", { count: "exact", head: true }),
      supabase.from("tree_updates").select("*", { count: "exact", head: true }),
    ]);
    const { data: contributors } = await supabase
      .from("trees")
      .select("planter_name");
    const { data: locations } = await supabase
      .from("trees")
      .select("location_name")
      .neq("location_name", "");

    const uniqueContributors = new Set(
      (contributors || []).map(function (r) { return r.planter_name; })
    ).size;
    const uniqueLocations = new Set(
      (locations || []).map(function (r) { return r.location_name; })
    ).size;

    return {
      trees: treeCount || 0,
      contributors: uniqueContributors || 0,
      locations: uniqueLocations || 0,
      updates: updateCount || 0,
    };
  } catch (err) {
    console.error("Failed to fetch stats:", err);
    return { trees: 0, contributors: 0, locations: 0, updates: 0 };
  }
}

async function initCounters() {
  const counters = document.querySelectorAll(".counter");
  if (counters.length === 0) return;

  const stats = await fetchStats();

  const counterMap = {
    "Trees Planted": "trees",
    "Contributors": "contributors",
    "Locations": "locations",
    "Locations Reached": "locations",
    "Growth Updates": "updates",
    "People Involved": "contributors",
  };

  counters.forEach(function (el) {
    const labelEl = el.nextElementSibling;
    const label = labelEl ? labelEl.textContent.trim() : "";
    const key = counterMap[label];
    if (key && stats[key] !== undefined) {
      el.dataset.target = stats[key];
    }
  });

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(function (c) {
    observer.observe(c);
  });
}

function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10) || 0;
  const suffix = el.dataset.suffix || "";
  const duration = 1500;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    el.textContent = current + suffix;
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target + suffix;
    }
  }

  requestAnimationFrame(update);
}

/* ==============================
   TREE UID GENERATION
============================= */

function generateTreeUID() {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var random = "";
  for (var i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return "GR-KAN-" + random;
}

/* ==============================
   PHOTO UPLOAD (Supabase Storage)
============================== */

var TREE_PHOTO_BUCKET = "tree-photos";

async function uploadTreePhoto(file, prefix) {
  var supabase = await window.getSupabaseClient();
  var ext = file.name.split(".").pop().toLowerCase();
  var fileName = prefix + "-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8) + "." + ext;
  var filePath = prefix + "/" + fileName;

  var { error } = await supabase.storage
    .from(TREE_PHOTO_BUCKET)
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (error) throw error;

  var { data: urlData } = supabase.storage
    .from(TREE_PHOTO_BUCKET)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/* ==============================
   UPDATE INTERVAL CONFIG
============================== */

var UPDATE_INTERVALS = {
  INITIAL_UPDATE_DAYS: 30,
  SUBSEQUENT_UPDATE_DAYS: 90,
  OVERDUE_DAYS: 180,
};

function getUpdateStatus(tree, updates) {
  var lastUpdateDate = null;
  var lastUpdate = updates.length > 0 ? updates[0] : null;
  if (lastUpdate) {
    lastUpdateDate = lastUpdate.update_date;
  }

  var referenceDate = lastUpdateDate || tree.planting_date;
  var interval = lastUpdate ? UPDATE_INTERVALS.SUBSEQUENT_UPDATE_DAYS : UPDATE_INTERVALS.INITIAL_UPDATE_DAYS;

  var daysSinceReference = daysBetween(referenceDate, new Date());
  if (daysSinceReference === null || daysSinceReference < 0) daysSinceReference = 0;

  var refDate = parseDateLocal(referenceDate);
  var nextDueDate = new Date(refDate.getTime() + interval * 24 * 60 * 60 * 1000);
  var nextDueStr = nextDueDate.getFullYear() + "-" +
    String(nextDueDate.getMonth() + 1).padStart(2, "0") + "-" +
    String(nextDueDate.getDate()).padStart(2, "0");

  var isOverdue = daysSinceReference >= UPDATE_INTERVALS.OVERDUE_DAYS;
  var isDue = daysSinceReference >= interval;

  if (isDue) {
    return {
      status: "due",
      daysSinceReference: daysSinceReference,
      nextDueDate: nextDueStr,
      isOverdue: isOverdue,
      lastUpdateDate: lastUpdateDate,
    };
  }

  if (lastUpdate) {
    return {
      status: "recently_updated",
      daysSinceReference: daysSinceReference,
      nextDueDate: nextDueStr,
      lastUpdateDate: lastUpdateDate,
    };
  }

  return {
    status: "not_due",
    daysSinceReference: daysSinceReference,
    nextDueDate: nextDueStr,
    lastUpdateDate: null,
  };
}

/* ==============================
   REGISTER FORM
============================== */

function initRegisterForm() {
  const form = document.getElementById("tree-form");
  if (!form) return;

  const nameInput = document.getElementById("planter-name");
  const emailInput = document.getElementById("planter-email");
  const typeInput = document.getElementById("tree-type");
  const dateInput = document.getElementById("planting-date");
  const locationMethod = document.querySelector(".location-method");
  const locationLat = document.querySelector(".location-lat");
  const locationLng = document.querySelector(".location-lng");
  const locationNameHidden = document.querySelector(".location-name-hidden");
  const photoInput = document.getElementById("tree-photo");
  const formMessage = document.getElementById("form-message");
  const submitBtn = document.getElementById("submit-btn");

  var isSubmitting = false;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (isSubmitting) return;

    clearErrors();
    formMessage.className = "form-message";
    formMessage.textContent = "";

    var valid = true;

    if (!nameInput.value.trim()) {
      showError("error-planter-name", "Please enter your name.");
      nameInput.classList.add("invalid");
      valid = false;
    } else if (nameInput.value.trim().length > 100) {
      showError("error-planter-name", "Name must be 100 characters or fewer.");
      nameInput.classList.add("invalid");
      valid = false;
    }

    var email = emailInput ? emailInput.value.trim() : "";
    if (!email) {
      showError("error-planter-email", "Please enter your email address.");
      if (emailInput) emailInput.classList.add("invalid");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("error-planter-email", "Please enter a valid email address.");
      emailInput.classList.add("invalid");
      valid = false;
    }

    if (!typeInput.value.trim()) {
      showError("error-tree-type", "Please enter the tree type.");
      typeInput.classList.add("invalid");
      valid = false;
    } else if (typeInput.value.trim().length > 80) {
      showError("error-tree-type", "Tree type must be 80 characters or fewer.");
      typeInput.classList.add("invalid");
      valid = false;
    }

    if (!dateInput.value) {
      showError("error-planting-date", "Please select a planting date.");
      dateInput.classList.add("invalid");
      valid = false;
    } else {
      var selectedDate = parseDateLocal(dateInput.value);
      var today = new Date();
      today.setHours(23, 59, 59, 999);
      if (!selectedDate) {
        showError("error-planting-date", "Please enter a valid date.");
        dateInput.classList.add("invalid");
        valid = false;
      } else if (selectedDate > today) {
        showError("error-planting-date", "Planting date cannot be in the future.");
        dateInput.classList.add("invalid");
        valid = false;
      }
    }

    var lat = parseFloat(locationLat.value);
    var lng = parseFloat(locationLng.value);
    if (!locationMethod.value || isNaN(lat) || isNaN(lng)) {
      showError("error-location", "Please select a planting location on the map.");
      valid = false;
    } else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showError("error-location", "Invalid location coordinates. Please reselect your location.");
      valid = false;
    }

    if (!photoInput.files || !photoInput.files[0]) {
      showError("error-tree-photo", "Please upload a photo of your tree.");
      valid = false;
    } else {
      var file = photoInput.files[0];
      var validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (validTypes.indexOf(file.type) === -1) {
        showError("error-tree-photo", "Please upload a JPG, PNG, or WebP image.");
        valid = false;
      } else if (file.size > 5 * 1024 * 1024) {
        showError("error-tree-photo", "Image must be 5MB or smaller.");
        valid = false;
      }
    }

    if (!valid) return;

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Registering...";
    formMessage.className = "form-message loading";
    formMessage.textContent = "Uploading photo & saving your tree...";

    try {
      var supabase = await window.getSupabaseClient();

      var treeUID = generateTreeUID();
      var photoFile = photoInput.files[0];

      formMessage.textContent = "Uploading your tree photo...";
      var photoUrl = await uploadTreePhoto(photoFile, "registration");
      if (!photoUrl) throw new Error("Photo upload failed — no URL returned.");

      formMessage.textContent = "Saving your tree...";
      var insertData = {
        planter_name: nameInput.value.trim(),
        planter_email: email,
        tree_type: typeInput.value.trim(),
        planting_date: dateInput.value,
        latitude: lat,
        longitude: lng,
        location_name: locationNameHidden.value || "",
        photo_url: photoUrl,
        tree_uid: treeUID,
      };

      var result = await supabase.from("trees").insert(insertData).select("id,tree_uid").single();

      if (result.error) throw result.error;

      var confirmedUID = result.data.tree_uid || treeUID;
      var confirmedTreeId = result.data.id;

      formMessage.className = "form-message";
      formMessage.textContent = "";

      // Fire-and-forget: trigger GreenPoints + email processing (never blocks registration)
      try {
        fetch(window.SUPABASE_URL + "/functions/v1/process-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + window.SUPABASE_ANON_KEY },
          body: JSON.stringify({ treeId: confirmedTreeId }),
        }).catch(function () {});
      } catch (e) {}

      var confirmation = document.createElement("div");
      confirmation.className = "success-confirmation";
      confirmation.innerHTML =
        '<div class="success-icon">🌳</div>' +
        '<h3>Tree Successfully Registered!</h3>' +
        '<p>Save your Tree UID — you will need it to track and update your tree.</p>' +
        '<p class="greenpoints-earned">🌿 +100 GreenPoints earned! Check your email for confirmation.</p>' +
        '<div class="tree-ref">Your Tree UID: ' + escapeHtml(confirmedUID) + '</div>' +
        '<div class="success-actions">' +
        '<button type="button" onclick="window.location.href=\'track.html\'">🌿 Track My Tree</button>' +
        '<button type="button" class="btn-secondary" onclick="resetRegisterForm()">🌱 Register Another</button>' +
        '</div>';

      form.appendChild(confirmation);
      confirmation.scrollIntoView({ behavior: "smooth", block: "center" });

      form.reset();
      if (locationMethod) locationMethod.value = "";
      if (locationLat) locationLat.value = "";
      if (locationLng) locationLng.value = "";
      if (locationNameHidden) locationNameHidden.value = "";
      var locationStatus = document.querySelector(".location-status");
      if (locationStatus) locationStatus.textContent = "Location not selected yet";

      submitBtn.textContent = "🌳 Register My Tree";
      submitBtn.disabled = false;
      isSubmitting = false;
    } catch (err) {
      console.error("Registration error:", err);
      formMessage.className = "form-message error";
      formMessage.textContent =
        "Unable to register your tree right now. Please try again in a moment.";
      submitBtn.textContent = "🌳 Register My Tree";
      submitBtn.disabled = false;
      isSubmitting = false;
    }
  });

  function showError(id, msg) {
    var el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  function clearErrors() {
    document.querySelectorAll(".field-error").forEach(function (el) {
      el.textContent = "";
    });
    document.querySelectorAll(".invalid").forEach(function (el) {
      el.classList.remove("invalid");
    });
  }

  if (nameInput) nameInput.addEventListener("input", function () {
    if (nameInput.value.trim()) nameInput.classList.remove("invalid");
  });
  if (emailInput) emailInput.addEventListener("input", function () {
    if (emailInput.value.trim()) emailInput.classList.remove("invalid");
  });
  if (typeInput) typeInput.addEventListener("input", function () {
    if (typeInput.value.trim()) typeInput.classList.remove("invalid");
  });
  if (dateInput) dateInput.addEventListener("change", function () {
    if (dateInput.value) dateInput.classList.remove("invalid");
  });
}

function resetRegisterForm() {
  var confirmation = document.querySelector(".success-confirmation");
  if (confirmation) confirmation.remove();
  var form = document.getElementById("tree-form");
  if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ==============================
   CONTACT FORM
============================== */

function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const nameInput = document.getElementById("contact-name");
  const emailInput = document.getElementById("contact-email");
  const messageInput = document.getElementById("contact-message");
  const formMessage = document.getElementById("contact-form-message");
  const submitBtn = document.getElementById("contact-submit-btn");

  var isSubmitting = false;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (isSubmitting) return;

    clearContactErrors();
    formMessage.className = "form-message";
    formMessage.textContent = "";

    var valid = true;

    if (!nameInput.value.trim()) {
      showContactError("error-contact-name", "Please enter your name.");
      nameInput.classList.add("invalid");
      valid = false;
    }

    var email = emailInput.value.trim();
    if (!email) {
      showContactError("error-contact-email", "Please enter your email.");
      emailInput.classList.add("invalid");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showContactError("error-contact-email", "Please enter a valid email address.");
      emailInput.classList.add("invalid");
      valid = false;
    }

    if (!messageInput.value.trim()) {
      showContactError("error-contact-message", "Please enter a message.");
      messageInput.classList.add("invalid");
      valid = false;
    } else if (messageInput.value.trim().length > 2000) {
      showContactError("error-contact-message", "Message must be 2000 characters or fewer.");
      messageInput.classList.add("invalid");
      valid = false;
    }

    if (!valid) return;

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    formMessage.className = "form-message loading";
    formMessage.textContent = "Sending your message...";

    try {
      var supabase = await window.getSupabaseClient();
      var { error } = await supabase.from("contact_messages").insert({
        name: nameInput.value.trim(),
        email: email,
        message: messageInput.value.trim(),
      });

      if (error) throw error;

      formMessage.className = "form-message success";
      formMessage.textContent =
        "✅ Thank you! Your message has been sent. We'll get back to you soon.";
      form.reset();
      submitBtn.textContent = "📨 Send Message";
      submitBtn.disabled = false;
      isSubmitting = false;

      setTimeout(function () {
        formMessage.className = "form-message";
        formMessage.textContent = "";
      }, 6000);
    } catch (err) {
      console.error("Contact form error:", err);
      formMessage.className = "form-message error";
      formMessage.textContent =
        "Unable to send your message right now. Please try again later.";
      submitBtn.textContent = "📨 Send Message";
      submitBtn.disabled = false;
      isSubmitting = false;
    }
  });

  function showContactError(id, msg) {
    var el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  function clearContactErrors() {
    document.querySelectorAll(".field-error").forEach(function (el) {
      el.textContent = "";
    });
    document.querySelectorAll(".invalid").forEach(function (el) {
      el.classList.remove("invalid");
    });
  }
}

/* ==============================
   TRACK PAGE (UID-based)
============================== */

function initTrackPage() {
  var uidInput = document.getElementById("track-uid-input");
  var uidBtn = document.getElementById("track-uid-btn");
  var uidMessage = document.getElementById("track-uid-message");
  var trackResult = document.getElementById("track-result");

  if (!uidInput || !uidBtn) return;

  var trackMap = null;

  uidBtn.addEventListener("click", function () {
    handleTrackUID();
  });

  uidInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTrackUID();
    }
  });

  function handleTrackUID() {
    var uid = uidInput.value.trim().toUpperCase();
    uidMessage.className = "track-uid-message";
    uidMessage.textContent = "";

    if (!uid) {
      uidMessage.className = "track-uid-message error";
      uidMessage.textContent = "Please enter your Tree UID.";
      return;
    }

    uidBtn.disabled = true;
    uidBtn.textContent = "Searching...";
    uidMessage.className = "track-uid-message loading";
    uidMessage.textContent = "Looking up your tree...";
    trackResult.style.display = "none";

    lookupTreeByUID(uid, trackMap).then(function (result) {
      uidBtn.disabled = false;
      uidBtn.textContent = "Track My Tree";

      if (result.error) {
        uidMessage.className = "track-uid-message error";
        uidMessage.textContent = result.error;
        trackResult.style.display = "none";
        return;
      }

      uidMessage.className = "track-uid-message";
      uidMessage.textContent = "";
      trackResult.style.display = "block";
      showTreeDetail(result.tree, result.updates, trackMap);
    });
  }
}

async function lookupTreeByUID(uid, trackMap) {
  try {
    var supabase = await window.getSupabaseClient();
    var { data: tree, error: treeError } = await supabase
      .from("trees")
      .select("*")
      .eq("tree_uid", uid)
      .maybeSingle();

    if (treeError) throw treeError;

    if (!tree) {
      return { error: "Tree UID not found. Please check your UID and try again." };
    }

    var { data: updates, error: updatesError } = await supabase
      .from("tree_updates")
      .select("*")
      .eq("tree_id", tree.id)
      .order("update_date", { ascending: false });

    if (updatesError) throw updatesError;

    return { tree: tree, updates: updates || [] };
  } catch (err) {
    console.error("Track lookup error:", err);
    return { error: "Unable to look up your tree right now. Please try again." };
  }
}

function showTreeDetail(tree, updates, trackMap) {
  var detailEl = document.getElementById("tree-detail");
  if (!detailEl) return;

  var daysPlanted = daysBetween(tree.planting_date, new Date());
  if (daysPlanted === null || daysPlanted < 0) daysPlanted = 0;

  var stageIcon = {
    seedling: "🌱",
    sapling: "🌿",
    young: "🌳",
    mature: "🌲",
  }[tree.growth_stage] || "🌱";

  // Build growth timeline
  var timelineEntries = [];

  timelineEntries.push({
    type: "planting",
    date: tree.planting_date,
    label: "Tree Planted",
    stats: "Planted by " + escapeHtml(tree.planter_name),
    notes: null,
  });

  var chronoUpdates = updates.slice().reverse();
  chronoUpdates.forEach(function (u) {
    var stats = [];
    if (u.height_cm) stats.push(u.height_cm + " cm");
    stats.push("Health: " + escapeHtml(u.health_status));
    if (u.growth_stage) stats.push("Stage: " + escapeHtml(u.growth_stage));
    timelineEntries.push({
      type: "update",
      date: u.update_date,
      label: "Growth Update",
      stats: stats.join(" · "),
      notes: u.notes,
      photoUrl: u.photo_url || null,
    });
  });

  var timelineHtml = '<div class="growth-timeline">';
  timelineEntries.forEach(function (entry) {
    timelineHtml +=
      '<div class="timeline-entry ' + entry.type + '">' +
      '<div class="timeline-date">' + formatDate(entry.date) + '</div>' +
      '<div class="timeline-label">' + escapeHtml(entry.label) + '</div>' +
      '<div class="timeline-stats">' + entry.stats + '</div>' +
      (entry.notes ? '<p>' + escapeHtml(entry.notes) + '</p>' : '') +
      (entry.photoUrl ? '<img class="timeline-photo" src="' + escapeHtml(entry.photoUrl) + '" alt="Tree photo" />' : '') +
      '</div>';
  });
  timelineHtml += '</div>';

  var daysLabel;
  if (daysPlanted === 0) {
    daysLabel = "Planted today";
  } else {
    daysLabel = daysPlanted + " day" + (daysPlanted !== 1 ? "s" : "") + " since planting";
  }

  var photoHtml = "";
  if (tree.photo_url) {
    photoHtml =
      '<div class="tree-photo-display">' +
      '<div class="tree-photo-label">Registration Photo</div>' +
      '<img src="' + escapeHtml(tree.photo_url) + '" alt="Registration photo" />' +
      '</div>';
  }

  detailEl.innerHTML =
    '<div class="detail-header">' +
    "<h3>" + stageIcon + " " + escapeHtml(tree.tree_type) + "</h3>" +
    "<p>Planted by " + escapeHtml(tree.planter_name) + "</p>" +
    '<div class="tree-uid-display">Tree UID: <strong>' + escapeHtml(tree.tree_uid) + '</strong></div>' +
    "</div>" +
    photoHtml +
    '<div class="detail-grid">' +
    '<div class="detail-item"><label>Planting Date</label><span class="value">' + formatDate(tree.planting_date) + "</span></div>" +
    '<div class="detail-item"><label>Time Since Planting</label><span class="value">' + daysLabel + "</span></div>" +
    '<div class="detail-item"><label>Growth Stage</label><span class="value">' + escapeHtml(tree.growth_stage) + "</span></div>" +
    '<div class="detail-item"><label>Status</label><span class="value">' + escapeHtml(tree.status) + "</span></div>" +
    '<div class="detail-item"><label>Location</label><span class="value">' + escapeHtml(tree.location_name || "Not specified") + "</span></div>" +
    '<div class="detail-item"><label>Coordinates</label><span class="value">' + tree.latitude.toFixed(4) + ", " + tree.longitude.toFixed(4) + "</span></div>" +
    "</div>" +
    '<div class="update-section" id="update-section"></div>' +
    '<div class="detail-updates">' +
    "<h4>🌿 Growth Timeline</h4>" +
    timelineHtml +
    "</div>" +
    '<div id="track-map"></div>';

  // Show update form first — a map initialization error must never block it.
  var updateSection = document.getElementById("update-section");
  if (updateSection) {
    renderUpdateForm(updateSection, tree, updates);
  }

  if (typeof L !== "undefined") {
    try {
      initTrackMap(tree);
    } catch (mapErr) {
      console.error("Track map error:", mapErr);
    }
  }

  detailEl.scrollIntoView({ behavior: "smooth", block: "start" });

  if (tree.planter_email) {
    renderMyGreenPoints(tree.planter_email);
  } else {
    var gpEl = document.getElementById("my-greenpoints");
    if (gpEl) gpEl.style.display = "none";
  }
}

async function renderMyGreenPoints(email) {
  var gpEl = document.getElementById("my-greenpoints");
  if (!gpEl) return;

  var normalizedEmail = email.toLowerCase().trim();

  try {
    var supabase = await window.getSupabaseClient();
    var { data: balance, error: balError } = await supabase
      .from("greenpoints_balances")
      .select("total_points, trees_count, updates_count")
      .eq("email_key", normalizedEmail)
      .maybeSingle();

    if (balError) throw balError;

    var { data: userAchievements, error: achError } = await supabase
      .from("achievements")
      .select("achievement_key, unlocked_at")
      .eq("email_key", normalizedEmail)
      .order("unlocked_at", { ascending: false });

    if (achError) throw achError;

    var unlockedKeys = {};
    (userAchievements || []).forEach(function (a) {
      unlockedKeys[a.achievement_key] = true;
    });

    var totalPoints = balance ? balance.total_points : 0;
    var treesCount = balance ? balance.trees_count : 0;
    var updatesCount = balance ? balance.updates_count : 0;

    var achHtml = "";
    Object.keys(ACHIEVEMENT_DEFS).forEach(function (key) {
      var def = ACHIEVEMENT_DEFS[key];
      var isUnlocked = !!unlockedKeys[key];
      achHtml +=
        '<div class="achievement-badge' + (isUnlocked ? " unlocked" : " locked") + '">' +
        '<div class="badge-icon">' + def.icon + '</div>' +
        '<div class="badge-info">' +
        '<strong>' + escapeHtml(def.name) + '</strong>' +
        '<span>' + escapeHtml(def.desc) + '</span>' +
        (isUnlocked ? '<em>Unlocked</em>' : '<em>Locked</em>') +
        '</div>' +
        '</div>';
    });

    gpEl.innerHTML =
      '<div class="my-gp-header">' +
      '<h3>My GreenPoints</h3>' +
      '<p>Your personal contribution to a greener planet</p>' +
      '</div>' +
      '<div class="my-gp-stats">' +
      '<div class="gp-stat-card">' +
      '<div class="gp-stat-icon">🌿</div>' +
      '<strong>' + totalPoints + '</strong>' +
      '<span>Total GreenPoints</span>' +
      '</div>' +
      '<div class="gp-stat-card">' +
      '<div class="gp-stat-icon">🌳</div>' +
      '<strong>' + treesCount + '</strong>' +
      '<span>Trees Registered</span>' +
      '</div>' +
      '<div class="gp-stat-card">' +
      '<div class="gp-stat-icon">📸</div>' +
      '<strong>' + updatesCount + '</strong>' +
      '<span>Growth Updates</span>' +
      '</div>' +
      '</div>' +
      '<div class="my-gp-achievements">' +
      '<h4>🏆 Achievements</h4>' +
      '<div class="achievements-grid">' + achHtml + '</div>' +
      '</div>';

    gpEl.style.display = "block";
  } catch (err) {
    console.error("Failed to load personal GreenPoints:", err);
    gpEl.style.display = "none";
  }
}

var _trackMapInstance = null;

function initTrackMap(tree) {
  if (_trackMapInstance) {
    _trackMapInstance.remove();
    _trackMapInstance = null;
  }
  var mapEl = document.getElementById("track-map");
  if (!mapEl) return;

  _trackMapInstance = L.map("track-map").setView([tree.latitude, tree.longitude], 14);
  var tileUrl =
    "https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=6b4b353b3eb74bd191c7ae4751a7a86a";
  L.tileLayer(tileUrl, {
    maxZoom: 20,
    attribution:
      'Powered by <a href="https://www.geoapify.com/" target="_blank">Geoapify</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
  }).addTo(_trackMapInstance);

  L.marker([tree.latitude, tree.longitude])
    .addTo(_trackMapInstance)
    .bindPopup(
      "<strong>" + escapeHtml(tree.tree_type) + "</strong><br>" +
      escapeHtml(tree.planter_name) + "<br>" +
      escapeHtml(tree.location_name || "")
    )
    .openPopup();

  setTimeout(function () {
    if (_trackMapInstance) _trackMapInstance.invalidateSize();
  }, 100);
}

/* ==============================
   TREE UPDATE FORM
============================== */

function renderUpdateForm(container, tree, updates) {
  if (!updates) updates = [];
  var updateStatus = getUpdateStatus(tree, updates);

  var statusHtml = "";
  if (updateStatus.status === "not_due") {
    statusHtml =
      '<div class="update-status not-due">' +
      '<div class="update-status-icon">🌱</div>' +
      '<h4>Update not needed yet</h4>' +
      '<p>Your tree is newly planted. Your next update will be requested on/after ' +
      formatDate(updateStatus.nextDueDate) + '.</p>' +
      '</div>';
  } else if (updateStatus.status === "recently_updated") {
    statusHtml =
      '<div class="update-status recently-updated">' +
      '<div class="update-status-icon">✅</div>' +
      '<h4>Tree update recorded</h4>' +
      '<p>Your next update will be due on ' +
      formatDate(updateStatus.nextDueDate) + '.</p>' +
      '</div>';
  } else if (updateStatus.status === "due") {
    var dueDesc = updateStatus.lastUpdateDate
      ? 'Your last update was ' + updateStatus.daysSinceReference + ' days ago.'
      : 'Your tree was planted ' + updateStatus.daysSinceReference + ' days ago.';
    statusHtml =
      '<div class="update-status due">' +
      '<div class="update-status-icon">🌿</div>' +
      '<h4>Your tree is due for a growth update.</h4>' +
      '<p>' + escapeHtml(dueDesc) + ' Please provide the current status of your tree so GreenRoots can track its growth.</p>' +
      '</div>';
  }

  var formHtml = "";
  if (updateStatus.status === "due") {
    formHtml =
      '<div class="update-form-container">' +
      '<h3>📝 Update Your Tree</h3>' +
      '<p class="update-form-intro">Help GreenRoots track your tree\'s growth. Submit a new update below.</p>' +
      '<form class="tree-update-form" id="tree-update-form" novalidate>' +
      '<div class="form-group">' +
      '<label for="update-growth-stage">Current Growth Stage <span class="required">*</span></label>' +
      '<select id="update-growth-stage" required>' +
      '<option value="">Select growth stage</option>' +
      '<option value="seedling">🌱 Seedling</option>' +
      '<option value="sapling">🌿 Sapling</option>' +
      '<option value="young">🌳 Young</option>' +
      '<option value="mature">🌲 Mature</option>' +
      '</select>' +
      '<span class="field-error" id="error-update-stage"></span>' +
      '</div>' +
      '<div class="form-group">' +
      '<label for="update-height">Current Height (cm)</label>' +
      '<input type="number" id="update-height" placeholder="e.g. 120" min="0" max="100000">' +
      '<span class="field-error" id="error-update-height"></span>' +
      '</div>' +
      '<div class="form-group">' +
      '<label for="update-health">Health Status <span class="required">*</span></label>' +
      '<select id="update-health" required>' +
      '<option value="">Select health status</option>' +
      '<option value="healthy">Healthy</option>' +
      '<option value="needs_attention">Needs Attention</option>' +
      '<option value="diseased">Diseased</option>' +
      '<option value="deceased">Deceased</option>' +
      '</select>' +
      '<span class="field-error" id="error-update-health"></span>' +
      '</div>' +
      '<div class="form-group">' +
      '<label for="update-notes">Notes / Observations</label>' +
      '<textarea id="update-notes" placeholder="Share any observations about your tree..." rows="3"></textarea>' +
      '<span class="field-error" id="error-update-notes"></span>' +
      '</div>' +
      '<div class="form-group">' +
      '<label for="update-photo">Current Tree Photo <span class="required">*</span></label>' +
      '<input type="file" id="update-photo" accept="image/jpeg,image/png,image/webp" required>' +
      '<p class="photo-hint">Required — share a current photo (JPG, PNG, or WebP, max 5MB)</p>' +
      '<span class="field-error" id="error-update-photo"></span>' +
      '</div>' +
      '<div class="form-message" id="update-form-message"></div>' +
      '<button type="submit" id="update-submit-btn">📝 Submit Update</button>' +
      '</form>' +
      '</div>';
  }

  container.innerHTML = statusHtml + formHtml;

  if (updateStatus.status !== "due") return;

  var updateForm = document.getElementById("tree-update-form");
  if (!updateForm) return;

  var isUpdating = false;

  updateForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (isUpdating) return;

    var msgEl = document.getElementById("update-form-message");
    var btn = document.getElementById("update-submit-btn");
    var stageSelect = document.getElementById("update-growth-stage");
    var healthSelect = document.getElementById("update-health");
    var heightInput = document.getElementById("update-height");
    var notesInput = document.getElementById("update-notes");
    var photoInput = document.getElementById("update-photo");

    // Clear errors
    document.querySelectorAll("#tree-update-form .field-error").forEach(function (el) {
      el.textContent = "";
    });
    document.querySelectorAll("#tree-update-form .invalid").forEach(function (el) {
      el.classList.remove("invalid");
    });
    msgEl.className = "form-message";
    msgEl.textContent = "";

    var valid = true;

    if (!stageSelect.value) {
      var el = document.getElementById("error-update-stage");
      if (el) el.textContent = "Please select a growth stage.";
      stageSelect.classList.add("invalid");
      valid = false;
    }

    if (!healthSelect.value) {
      var el = document.getElementById("error-update-health");
      if (el) el.textContent = "Please select a health status.";
      healthSelect.classList.add("invalid");
      valid = false;
    }

    var heightVal = heightInput.value.trim();
    if (heightVal) {
      var h = parseInt(heightVal, 10);
      if (isNaN(h) || h < 0) {
        var el = document.getElementById("error-update-height");
        if (el) el.textContent = "Height must be a positive number.";
        heightInput.classList.add("invalid");
        valid = false;
      }
    }

    if (!photoInput.files || !photoInput.files[0]) {
      var el = document.getElementById("error-update-photo");
      if (el) el.textContent = "Please upload a current photo of your tree.";
      valid = false;
    } else {
      var file = photoInput.files[0];
      var validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (validTypes.indexOf(file.type) === -1) {
        var el = document.getElementById("error-update-photo");
        if (el) el.textContent = "Please upload a JPG, PNG, or WebP image.";
        valid = false;
      } else if (file.size > 5 * 1024 * 1024) {
        var el = document.getElementById("error-update-photo");
        if (el) el.textContent = "Image must be 5MB or smaller.";
        valid = false;
      }
    }

    if (!valid) return;

    isUpdating = true;
    btn.disabled = true;
    btn.textContent = "Submitting...";
    msgEl.className = "form-message loading";
    msgEl.textContent = "Uploading photo & saving your update...";

    try {
      var supabase = await window.getSupabaseClient();

      var photoFile = photoInput.files[0];
      msgEl.textContent = "Uploading your update photo...";
      var photoUrl = await uploadTreePhoto(photoFile, "updates");
      if (!photoUrl) throw new Error("Photo upload failed — no URL returned.");

      msgEl.textContent = "Saving your update...";
      var updateData = {
        tree_id: tree.id,
        update_date: todayStr(),
        height_cm: heightVal ? parseInt(heightVal, 10) : null,
        health_status: healthSelect.value,
        growth_stage: stageSelect.value,
        notes: notesInput.value.trim() || null,
        photo_url: photoUrl,
      };

      var { error: insertError } = await supabase.from("tree_updates").insert(updateData);

      if (insertError) throw insertError;

      // Fire-and-forget: trigger GreenPoints + email processing (never blocks update)
      try {
        fetch(window.SUPABASE_URL + "/functions/v1/process-update", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + window.SUPABASE_ANON_KEY },
          body: JSON.stringify({ treeId: tree.id }),
        }).catch(function () {});
      } catch (e) {}

      var nextDueDate = new Date(parseDateLocal(todayStr()).getTime() + UPDATE_INTERVALS.SUBSEQUENT_UPDATE_DAYS * 24 * 60 * 60 * 1000);
      var nextDueStr = nextDueDate.getFullYear() + "-" +
        String(nextDueDate.getMonth() + 1).padStart(2, "0") + "-" +
        String(nextDueDate.getDate()).padStart(2, "0");

      msgEl.className = "form-message success";
      msgEl.textContent = "🌱 Tree update successfully recorded! Your next update will be due on " + formatDate(nextDueStr) + ".";
      updateForm.reset();
      btn.textContent = "📝 Submit Update";
      btn.disabled = false;
      isUpdating = false;

      // Reload the tree detail to show the new update in the timeline
      setTimeout(function () {
        lookupTreeByUID(tree.tree_uid, null).then(function (result) {
          if (!result.error) {
            showTreeDetail(result.tree, result.updates, null);
          }
        });
      }, 2500);

      setTimeout(function () {
        msgEl.className = "form-message";
        msgEl.textContent = "";
      }, 6000);
    } catch (err) {
      console.error("Update submission error:", err);
      msgEl.className = "form-message error";
      msgEl.textContent =
        "Unable to save your update right now. Please try again later.";
      btn.textContent = "📝 Submit Update";
      btn.disabled = false;
      isUpdating = false;
    }
  });
}

/* ==============================
   COMMUNITY PAGE
============================== */

async function initCommunityPage() {
  var activityFeed = document.getElementById("activity-feed");
  var speciesChart = document.getElementById("species-chart");
  var contributorsGrid = document.getElementById("contributors-grid");
  var stageBreakdown = document.getElementById("stage-breakdown");

  if (!activityFeed && !speciesChart && !contributorsGrid) return;

  var trees = [];
  try {
    var supabase = await window.getSupabaseClient();
    var { data, error } = await supabase
      .from("trees")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    trees = data || [];
  } catch (err) {
    console.error("Failed to load community data:", err);
    if (activityFeed)
      activityFeed.innerHTML =
        '<div class="error-state">' +
        '<div class="error-state-icon">⚠️</div>' +
        '<h4>Unable to load activity</h4>' +
        '<p>Please try again later.</p>' +
        '</div>';
    if (speciesChart)
      speciesChart.innerHTML =
        '<div class="track-loading">Unable to load species data.</div>';
    if (contributorsGrid)
      contributorsGrid.innerHTML =
        '<div class="track-loading">Unable to load contributors.</div>';
    return;
  }

  if (activityFeed) renderActivityFeed(trees);
  if (speciesChart) renderSpeciesChart(trees);
  if (contributorsGrid) renderContributors(trees);
  if (stageBreakdown) renderStageBreakdown(trees);

  // Phase 5: GreenPoints community dashboard
  var gpSection = document.getElementById("greenpoints-section");
  if (gpSection) {
    renderGreenPointsCommunity(supabase);
  }
}

function renderStageBreakdown(trees) {
  var el = document.getElementById("stage-breakdown");
  if (!el) return;

  if (trees.length === 0) {
    el.style.display = "none";
    return;
  }

  var stages = {
    seedling: { icon: "🌱", label: "Seedlings" },
    sapling: { icon: "🌿", label: "Saplings" },
    young: { icon: "🌳", label: "Young Trees" },
    mature: { icon: "🌲", label: "Mature Trees" },
  };

  var counts = { seedling: 0, sapling: 0, young: 0, mature: 0 };
  trees.forEach(function (t) {
    if (counts[t.growth_stage] !== undefined) counts[t.growth_stage]++;
  });

  var hasAny = false;
  for (var k in counts) { if (counts[k] > 0) hasAny = true; }
  if (!hasAny) { el.style.display = "none"; return; }

  el.style.display = "flex";
  el.innerHTML = "";
  ["seedling", "sapling", "young", "mature"].forEach(function (stage) {
    if (counts[stage] === 0) return;
    var card = document.createElement("div");
    card.className = "stage-card";
    card.innerHTML =
      '<div class="stage-card-icon">' + stages[stage].icon + '</div>' +
      '<strong>' + counts[stage] + '</strong>' +
      '<span>' + stages[stage].label + '</span>';
    el.appendChild(card);
  });
}

function renderActivityFeed(trees) {
  var feed = document.getElementById("activity-feed");
  if (!feed) return;

  if (trees.length === 0) {
    feed.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-state-icon">🌱</div>' +
      '<h4>No activity yet</h4>' +
      '<p>Once trees are registered, their activity will appear here.</p>' +
      '<a href="register.html">Register the first tree →</a>' +
      '</div>';
    return;
  }

  var recent = trees.slice(0, 8);
  feed.innerHTML = recent
    .map(function (t) {
      var stageIcon = {
        seedling: "🌱",
        sapling: "🌿",
        young: "🌳",
        mature: "🌲",
      }[t.growth_stage] || "🌱";
      var timeAgo = formatTimeAgo(t.created_at);

      return (
        '<div class="activity-item">' +
        '<div class="activity-avatar">' + stageIcon + "</div>" +
        '<div class="activity-content">' +
        '<div class="activity-text"><strong>' + escapeHtml(t.planter_name) +
        "</strong> planted a <strong>" + escapeHtml(t.tree_type) +
        "</strong>" + (t.location_name ? " in " + escapeHtml(t.location_name) : "") + "</div>" +
        '<div class="activity-time">' + timeAgo + "</div>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function renderSpeciesChart(trees) {
  var chart = document.getElementById("species-chart");
  if (!chart) return;

  if (trees.length === 0) {
    chart.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-state-icon">🌳</div>' +
      '<h4>No species data yet</h4>' +
      '<p>Species distribution will appear once trees are registered.</p>' +
      '</div>';
    return;
  }

  var counts = {};
  trees.forEach(function (t) {
    var type = t.tree_type || "Unknown";
    counts[type] = (counts[type] || 0) + 1;
  });

  var sorted = Object.entries(counts).sort(function (a, b) {
    return b[1] - a[1];
  });
  var maxCount = sorted[0][1];

  chart.innerHTML = sorted
    .map(function (entry) {
      var pct = (entry[1] / maxCount) * 100;
      return (
        '<div class="species-bar-row">' +
        '<div class="species-label">' + escapeHtml(entry[0]) + "</div>" +
        '<div class="species-bar-bg">' +
        '<div class="species-bar-fill" style="width:' + pct + '%"></div>' +
        "</div>" +
        '<div class="species-count">' + entry[1] + "</div>" +
        "</div>"
      );
    })
    .join("");
}

function renderContributors(trees) {
  var grid = document.getElementById("contributors-grid");
  if (!grid) return;

  if (trees.length === 0) {
    grid.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-state-icon">🤝</div>' +
      '<h4>No contributors yet</h4>' +
      '<p>Top contributors will appear here once trees are registered.</p>' +
      '</div>';
    return;
  }

  var counts = {};
  trees.forEach(function (t) {
    counts[t.planter_name] = (counts[t.planter_name] || 0) + 1;
  });

  var sorted = Object.entries(counts)
    .sort(function (a, b) {
      return b[1] - a[1];
    })
    .slice(0, 6);

  var icons = ["🌱", "🌳", "🌿", "🌲", "🪴", "🍃"];

  grid.innerHTML = sorted
    .map(function (entry, i) {
      return (
        '<div class="contributor-card">' +
        '<div class="contributor-avatar">' + (icons[i] || "🌿") + "</div>" +
        '<div class="contributor-name">' + escapeHtml(entry[0]) + "</div>" +
        '<div class="contributor-count">' + entry[1] + " tree" + (entry[1] > 1 ? "s" : "") + " planted</div>" +
        "</div>"
      );
    })
    .join("");
}

/* ==============================
   HELPERS
============================== */

/* ==============================
   GREENPOINTS COMMUNITY DASHBOARD
============================= */

var ACHIEVEMENT_DEFS = {
  first_seed: { icon: "🌱", name: "First Seed", desc: "Registered first tree" },
  nature_guardian: { icon: "🌿", name: "Nature Guardian", desc: "Registered 5 trees" },
  forest_builder: { icon: "🌳", name: "Forest Builder", desc: "Registered 10 trees" },
  growth_champion: { icon: "🌻", name: "Growth Champion", desc: "6 updates on one tree" },
  greenroots_hero: { icon: "🏆", name: "GreenRoots Hero", desc: "Earned 1,000 GreenPoints" },
};

async function renderGreenPointsCommunity(supabase) {
  var overviewEl = document.getElementById("greenpoints-overview");
  var achievementsEl = document.getElementById("greenpoints-achievements");
  var leaderboardEl = document.getElementById("greenpoints-leaderboard");
  if (!overviewEl) return;

  try {
    var { data: balances, error: balError } = await supabase
      .from("greenpoints_balances")
      .select("email_key, total_points, trees_count, updates_count")
      .order("total_points", { ascending: false });

    if (balError) throw balError;

    var { data: achievements, error: achError } = await supabase
      .from("achievements")
      .select("achievement_key, email_key")
      .order("unlocked_at", { ascending: false });

    if (achError) throw achError;

    var totalPoints = 0;
    var totalTrees = 0;
    var totalUpdates = 0;
    (balances || []).forEach(function (b) {
      totalPoints += b.total_points || 0;
      totalTrees += b.trees_count || 0;
      totalUpdates += b.updates_count || 0;
    });

    overviewEl.innerHTML =
      '<div class="gp-stat-card">' +
      '<div class="gp-stat-icon">🌿</div>' +
      '<strong>' + totalPoints + '</strong>' +
      '<span>Total GreenPoints</span>' +
      '</div>' +
      '<div class="gp-stat-card">' +
      '<div class="gp-stat-icon">🌳</div>' +
      '<strong>' + totalTrees + '</strong>' +
      '<span>Trees Registered</span>' +
      '</div>' +
      '<div class="gp-stat-card">' +
      '<div class="gp-stat-icon">📸</div>' +
      '<strong>' + totalUpdates + '</strong>' +
      '<span>Growth Updates</span>' +
      '</div>' +
      '<div class="gp-stat-card">' +
      '<div class="gp-stat-icon">👥</div>' +
      '<strong>' + (balances ? balances.length : 0) + '</strong>' +
      '<span>Active Contributors</span>' +
      '</div>';

    var achCounts = {};
    (achievements || []).forEach(function (a) {
      achCounts[a.achievement_key] = (achCounts[a.achievement_key] || 0) + 1;
    });

    var achHtml = "";
    Object.keys(ACHIEVEMENT_DEFS).forEach(function (key) {
      var def = ACHIEVEMENT_DEFS[key];
      var count = achCounts[key] || 0;
      var isUnlocked = count > 0;
      achHtml +=
        '<div class="achievement-badge' + (isUnlocked ? " unlocked" : " locked") + '">' +
        '<div class="badge-icon">' + def.icon + '</div>' +
        '<div class="badge-info">' +
        '<strong>' + escapeHtml(def.name) + '</strong>' +
        '<span>' + escapeHtml(def.desc) + '</span>' +
        (isUnlocked ? '<em>' + count + ' contributor' + (count > 1 ? "s" : "") + '</em>' : '<em>Not yet unlocked</em>') +
        '</div>' +
        '</div>';
    });

    var achGrid = document.getElementById("achievements-grid");
    if (achGrid) achGrid.innerHTML = achHtml;
    if (achievementsEl) achievementsEl.style.display = "block";

    if (balances && balances.length > 0) {
      var top = balances.slice(0, 5);
      var medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      var lbHtml = top
        .map(function (b, i) {
          var displayName = anonymizeEmail(b.email_key);
          return (
            '<div class="leaderboard-row">' +
            '<span class="leaderboard-rank">' + (medals[i] || (i + 1)) + '</span>' +
            '<span class="leaderboard-name">' + escapeHtml(displayName) + '</span>' +
            '<span class="leaderboard-points">' + b.total_points + ' 🌿</span>' +
            '<span class="leaderboard-stats">' + b.trees_count + ' trees · ' + b.updates_count + ' updates</span>' +
            '</div>'
          );
        })
        .join('');
      var lbList = document.getElementById('leaderboard-list');
      if (lbList) lbList.innerHTML = lbHtml;
      if (leaderboardEl) leaderboardEl.style.display = 'block';
    }
  } catch (err) {
    console.error('Failed to load GreenPoints data:', err);
    overviewEl.innerHTML =
      '<div class="track-loading">GreenPoints data will appear here once trees are registered.</div>';
  }
}

function anonymizeEmail(email) {
  if (!email) return 'Anonymous';
  var parts = email.split('@');
  if (parts.length !== 2) return 'Anonymous';
  var name = parts[0];
  if (name.length <= 2) return name[0] + '***@' + parts[1];
  return name[0] + '***@' + parts[1];
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  var diff = Date.now() - new Date(timestamp).getTime();
  var days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return days + " days ago";
  if (days < 30) return Math.floor(days / 7) + " week" + (Math.floor(days / 7) > 1 ? "s" : "") + " ago";
  if (days < 365) return Math.floor(days / 30) + " month" + (Math.floor(days / 30) > 1 ? "s" : "") + " ago";
  return Math.floor(days / 365) + " year" + (Math.floor(days / 365) > 1 ? "s" : "") + " ago";
}
