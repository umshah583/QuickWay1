import UserForceLogoutClient from "./UserForceLogoutClient";

export const dynamic = "force-dynamic";

export default function ForceLogoutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <UserForceLogoutClient />
    </div>
  );
}
