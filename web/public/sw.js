// No offline cache: each visit receives the latest review build.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.path || "./#notifications",
    self.registration.scope,
  ).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if (client.url.startsWith(self.registration.scope)) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
self.addEventListener("push", (event) => {
  let data = { title: "기자재 대여·반출", body: "새 알림이 있습니다." };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag || "equipment-loan",
      data: { path: "./#notifications" },
    }),
  );
});
