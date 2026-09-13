import UserListPage from "@/components/UserListPage";

export default function FollowingPage({ params }: { params: { username: string } }) {
  return <UserListPage username={params.username} kind="following" />;
}
