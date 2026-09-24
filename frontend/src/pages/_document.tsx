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
          <link rel="manifest" href="/manifest.json" />
          <link rel="icon" type="image/x-icon" href="/img/favicon.ico?v=3" />
          <link rel="apple-touch-icon" href="/img/icons/icon-128x128.png?v=3" />

          <meta name="robots" content="noindex" />
          <meta name="theme-color" content="#4055a8" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
