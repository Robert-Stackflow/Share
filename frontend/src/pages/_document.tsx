import { ColorSchemeScript, MantineColorScheme } from "@mantine/core";
import Document, {
  DocumentContext,
  Head,
  Html,
  Main,
  NextScript,
} from "next/document";

function getColorSchemeFromCookie(cookieHeader?: string): MantineColorScheme {
  const match = cookieHeader?.match(/mantine-color-scheme=(light|dark|auto)/);
  return (match?.[1] as MantineColorScheme) ?? "auto";
}

export default class _Document extends Document<{
  colorScheme: MantineColorScheme;
}> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    const colorScheme = getColorSchemeFromCookie(ctx.req?.headers.cookie);
    return { ...initialProps, colorScheme };
  }

  render() {
    return (
      <Html>
        <Head>
          <ColorSchemeScript defaultColorScheme={this.props.colorScheme} />
          <link rel="manifest" href="/manifest.json?v=20260927-cube-clear" />
          <link rel="icon" type="image/x-icon" href="/img/favicon.ico?v=20260927-cube-clear" />
          <link rel="apple-touch-icon" sizes="180x180" href="/img/icons/icon-180x180.png?v=20260927-cube-clear" />

          <meta name="robots" content="noindex" />
          <meta name="theme-color" content="#4d63bf" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
