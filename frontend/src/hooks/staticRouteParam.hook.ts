import { useRouter } from "next/router";
import { useEffect, useState } from "react";

/**
 * Resolve a dynamic parameter when Caddy internally serves Next's `_`
 * placeholder page while keeping the original URL in the browser.
 */
export default function useStaticRouteParam(name: string, segment: number) {
  const router = useRouter();
  const queryValue = router.query[name];
  const initial =
    typeof queryValue === "string" && queryValue !== "_"
      ? queryValue
      : undefined;
  const [value, setValue] = useState<string | undefined>(initial);

  useEffect(() => {
    if (initial) {
      setValue(initial);
      return;
    }
    const pathValue = window.location.pathname.split("/").filter(Boolean)[segment];
    setValue(pathValue && pathValue !== "_" ? decodeURIComponent(pathValue) : undefined);
  }, [initial, segment]);

  return value ?? "";
}
