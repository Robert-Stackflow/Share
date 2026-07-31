import { useRouter } from "next/router";
import { useEffect } from "react";

const Admin = () => {
  const router = useRouter();
  useEffect(() => {
    void router.replace("/admin/users");
  }, [router]);
  return null;
};

export default Admin;
