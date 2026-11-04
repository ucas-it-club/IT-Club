import { createFileRoute, redirect } from "@tanstack/react-router";

// The site moved from /club to the root; old links move with it for good.
export const Route = createFileRoute("/club/")({
  beforeLoad: () => {
    throw redirect({ href: "/", statusCode: 301 });
  },
});
