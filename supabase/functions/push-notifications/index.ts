import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl =
  Deno.env.get("SUPABASE_URL")!;

const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const vapidPublicKey =
  Deno.env.get("VAPID_PUBLIC_KEY")!;

const vapidPrivateKey =
  Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails(
  "mailto:your-email@example.com",
  vapidPublicKey,
  vapidPrivateKey
);

const supabaseAdmin =
  createClient(
    supabaseUrl,
    serviceRoleKey
  );

Deno.serve(async request => {

  try {

    if(request.method !== "POST") {

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

    const notification =
      payload.record || payload;

    if(!notification?.user_id){

      return new Response(
        JSON.stringify({
          error: "Missing user_id"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

    }

    const {
      data: subscriptions,
      error: subscriptionError
    } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", notification.user_id);

    if(subscriptionError){

      throw subscriptionError;

    }

    if(!subscriptions?.length){

      return new Response(
        JSON.stringify({
          success: true,
          sent: 0
        }),
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

    }

    const notificationPayload =
      JSON.stringify({

        title:
          notification.title ||
          "CoupleFlow",

        body:
          notification.body ||
          "You have a new notification.",

        icon:
          "/icons/icon-192.png",

        badge:
          "/icons/icon-192.png",

        url:
          notification.url ||
          "/",

        tag:
          notification.type ||
          "coupleflow"

      });

    let sent = 0;

    for(const row of subscriptions){

      try {

        await webpush.sendNotification(
          row.subscription,
          notificationPayload
        );

        sent++;

      } catch(error: any){

        console.error(
          "Push error:",
          error
        );

        /*
         * HTTP 404/410 normally means
         * this subscription no longer exists.
         */

        if(
          error?.statusCode === 404 ||
          error?.statusCode === 410
        ){

          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("id", row.id);

        }

      }

    }

    return new Response(
      JSON.stringify({
        success: true,
        sent
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch(error){

    console.error(error);

    return new Response(
      JSON.stringify({
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
