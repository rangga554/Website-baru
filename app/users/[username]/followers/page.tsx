import UserListPage from "@/components/UserListPage";

export default function FollowersPage({ params }: { params: { username: string } }) {
  return <UserListPage username={params.username} kind="followers" />;
}
