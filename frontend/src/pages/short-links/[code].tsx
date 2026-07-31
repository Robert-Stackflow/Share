import ShortLinkDetailPage from "../../components/shortLink/ShortLinkDetailPage";
import { GetStaticPaths, GetStaticProps } from "next";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { code: "_" } }],
  fallback: false,
});
export const getStaticProps: GetStaticProps = async () => ({ props: {} });

export default ShortLinkDetailPage;
