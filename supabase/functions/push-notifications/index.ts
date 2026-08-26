import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject =
  Deno.env.get("VAPID_SUBJECT") || "mailto:your-email@example.com";

webpush.setVapidDetails(
  vapidSubject,
  vapidPublicKey,
  vapidPrivateKey
);

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey
);

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "POST required"
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const payload = await request.json();

    /*
     * Your CoupleFlow frontend sends:
     *
     * recipient_id
     * type
     * actor_id
     * actor_name
     * ...
     *
     * So use recipient_id as the notification target.
     */

    const notification = payload.record || payload;

    const recipientId =
      notification.recipient_id ||
      notification.user_id;

    if (!recipientId) {
      return new Response(
        JSON.stringify({
          error: "Missing recipient_id/user_id",
          received: notification
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    /*
     * Find all push subscriptions belonging
     * to the recipient.
     */

    const {
      data: subscriptions,
      error: subscriptionError
    } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", recipientId);

    if (subscriptionError) {
      throw subscriptionError;
    }

    /*
     * User has no registered phone/browser.
     */

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message: "No push subscription found for recipient"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    /*
     * Build notification text.
     */

    let title = notification.title || "CoupleFlow";
    let body = notification.body || "You have a new notification.";

    /*
     * Message notification
     */

    if (notification.type === "message") {
      title =
        notification.title ||
        notification.actor_name ||
        "New message";

      body =
        notification.body ||
        notification.message ||
        "You received a new message.";
    }

    /*
     * Goal notification
     */

    if (
      notification.type === "goal" ||
      notification.type === "goal_added"
    ) {
      title =
        notification.title ||
        "New goal added";

      body =
        notification.body ||
        notification.message ||
        "A new goal was added.";
    }

    /*
     * Goal update / completion
     */

    if (
      notification.type === "goal_update" ||
      notification.type === "goal_completed"
    ) {
      title =
        notification.title ||
        "Goal updated";

      body =
        notification.body ||
        notification.message ||
        "A goal was updated.";
    }

    /*
     * Update notification
     */

    if (
      notification.type === "update" ||
      notification.type === "update_added"
    ) {
      title =
        notification.title ||
        "New update";

      body =
        notification.body ||
        notification.message ||
        "You have a new update.";
    }

    const notificationPayload = JSON.stringify({
      title,
      body,

      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",

      data: {
        url: notification.url || "/"
      },

      url: notification.url || "/",

      tag:
        notification.type ||
        "coupleflow",

      type:
        notification.type ||
        "coupleflow"
    });

    let sent = 0;
    let removed = 0;

    /*
     * Send to every registered device for this user.
     */

    for (const row of subscriptions) {
      try {
        await webpush.sendNotification(
          row.subscription,
          notificationPayload
        );

        sent++;

        console.log(
          `Push notification sent to subscription ${row.id}`
        );

      } catch (error: any) {
        console.error(
          "Push notification error:",
          error
        );

        /*
         * 404 / 410 means the subscription
         * is no longer valid.
         */

        if (
          error?.statusCode === 404 ||
          error?.statusCode === 410
        ) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("id", row.id);

          removed++;

          console.log(
            `Removed expired subscription ${row.id}`
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipient_id: recipientId,
        subscriptions_found: subscriptions.length,
        sent,
        removed
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    console.error(
      "Push notification function error:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error)
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
});
