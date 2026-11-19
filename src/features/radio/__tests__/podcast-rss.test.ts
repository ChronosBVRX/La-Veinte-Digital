import { describe, it, expect } from "vitest"
import { parsePodcastRss } from "../services/podcast-rss"

describe("parsePodcastRss", () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title><![CDATA[La Veinte Radio]]></title>
    <description><![CDATA[<p>Espacio informativo sindical y laboral IMSS.</p>]]></description>
    <link>https://podcasters.spotify.com/pod/show/eduardo-bolaos-vzquez5</link>
    <itunes:author><![CDATA[Eduardo Bolaños Vázquez]]></itunes:author>
    <itunes:image href="https://example.com/cover.jpg" />
    <item>
      <title><![CDATA[Ep. 6 | ¿Cuántos Pacientes Me Tocan?]]></title>
      <description><![CDATA[<p>Análisis de indicadores IMSS &quot;con precisión&quot;.</p>]]></description>
      <pubDate>Thu, 19 Nov 2026 02:04:20 GMT</pubDate>
      <enclosure url="https://example.com/audio/ep6.mp3" length="8704834" type="audio/mpeg" />
      <itunes:duration>00:09:04</itunes:duration>
      <guid isPermaLink="false">guid-ep-6</guid>
    </item>
    <item>
      <title><![CDATA[Ep. 5 | Mismo Personal, Más Camillas]]></title>
      <description><![CDATA[Procedimiento 2900 y plantillas]]></description>
      <pubDate>Mon, 05 Oct 2026 02:41:39 GMT</pubDate>
      <enclosure url="https://example.com/audio/ep5.mp3" length="5000000" type="audio/mpeg" />
      <itunes:duration>540</itunes:duration>
      <guid isPermaLink="false">guid-ep-5</guid>
    </item>
  </channel>
</rss>`

  it("parses show metadata correctly", () => {
    const show = parsePodcastRss(sampleXml, "https://anchor.fm/test/rss")
    expect(show.title).toBe("La Veinte Radio")
    expect(show.author).toBe("Eduardo Bolaños Vázquez")
    expect(show.description).toBe("Espacio informativo sindical y laboral IMSS.")
    expect(show.imageUrl).toBe("https://example.com/cover.jpg")
    expect(show.link).toBe("https://podcasters.spotify.com/pod/show/eduardo-bolaos-vzquez5")
    expect(show.episodes).toHaveLength(2)
  })

  it("parses and formats episodes correctly", () => {
    const show = parsePodcastRss(sampleXml)
    const ep1 = show.episodes[0]

    expect(ep1.id).toBe("guid-ep-6")
    expect(ep1.title).toBe("Ep. 6 | ¿Cuántos Pacientes Me Tocan?")
    expect(ep1.cleanDescription).toBe('Análisis de indicadores IMSS "con precisión".')
    expect(ep1.audioUrl).toBe("https://example.com/audio/ep6.mp3")
    expect(ep1.duration).toBe("09:04")
    expect(ep1.formattedDate).toBeTruthy()

    const ep2 = show.episodes[1]
    expect(ep2.id).toBe("guid-ep-5")
    expect(ep2.duration).toBe("9:00") // 540 seconds formatted to 9:00
  })

  it("throws when XML has no channel", () => {
    expect(() => parsePodcastRss("<rss><invalid /></rss>")).toThrow()
  })
})
