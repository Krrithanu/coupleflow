const CACHE_NAME = "coupleflow-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

/* Install */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* Activate */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* Normal fetch */
self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {

        const copy = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, copy);
          });

        return response;

      })
      .catch(() => caches.match(event.request))
  );

});

/* =========================================================
   PUSH NOTIFICATION
   ========================================================= */

self.addEventListener("push", event => {

  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "CoupleFlow",
      body: event.data ? event.data.text() : "You have a new notification."
    };
  }

  const title = data.title || "CoupleFlow";

  const options = {
    body: data.body || "You have a new notification.",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",

    data: {
      url: data.url || "/"
    },

    tag: data.tag || "coupleflow",

    renotify: true,

    vibrate: [100, 50, 100]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );

});

/* =========================================================
   NOTIFICATION CLICK
   ========================================================= */

self.addEventListener("notificationclick", event => {

  event.notification.close();

  const targetUrl =
    event.notification?.data?.url || "/";

  event.waitUntil(

    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(clientList => {

      for (const client of clientList) {

        if ("focus" in client) {

          client.navigate(targetUrl);

          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

    })

  );

});
