import { useComputedColorScheme } from "@mantine/core";
import { useEffect, useState } from "react";

const defaultLogoSrc = "/img/logo.png?v=20260926-ribbon";
const darkLogoSrc = "/img/logo-dark.png?v=20260926-ribbon";

const Logo = ({ height, width }: { height: number; width: number }) => {
  const colorScheme = useComputedColorScheme("light");
  const preferredLogoSrc =
    colorScheme === "dark" ? darkLogoSrc : defaultLogoSrc;
  const [logoSrc, setLogoSrc] = useState(preferredLogoSrc);

  useEffect(() => {
    setLogoSrc(preferredLogoSrc);
  }, [preferredLogoSrc]);

  return (
    <img
      src={logoSrc}
      alt="Share"
      height={height}
      width={width}
      onError={() => {
        if (logoSrc !== defaultLogoSrc) setLogoSrc(defaultLogoSrc);
      }}
    />
  );
};
export default Logo;
