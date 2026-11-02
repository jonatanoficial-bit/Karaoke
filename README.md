# VALE KARAOKE — SING & SCORE

## Música em preparação: “Algo Novo” — Kemuel / Lukas Agustinho

Recebidos em 02/11/2026 dois áudios diferentes: gravação cantada (9min10s) e playback (6min55s), além de 77 frases da letra. A letra está em `songs/algo-novo-kemuel/letra-base.txt`.

**Não marque a música como pronta antes de enviar o playback e validar os tempos.** O GitHub atualmente contém os metadados e a letra, mas não os MP3s fornecidos na conversa.

Abra o [Editor de Sincronização](sincronizar.html) e marque as entradas das frases ouvindo **o playback**. O editor tem reprodução, velocidade ajustável, marcação por tecla Espaço, edição por décimos de segundo, salvamento local e exportação `.lrc`. Ele não envia áudio a servidores nem atualiza o GitHub automaticamente.

Veja os [passos específicos da faixa](songs/algo-novo-kemuel/INSTRUCOES.md). A música aparece na biblioteca como **EM PREPARAÇÃO**, sem reproduzir arquivo ausente.

---


Karaokê web responsivo, independente do VALE GAME PLAY, publicado em **GitHub Pages**. Funciona em computador e Android (navegadores modernos). Somente HTML, CSS e JavaScript — sem servidores e sem dependências de build.

## Funcionalidades

- Palco visual premium, catálogo, busca, filtros, player de áudio, barra de progresso e volume.
- Letras sincronizadas em formato **.lrc**.
- Captura de microfone com Web Audio API, identificação de frequência fundamental e comparação com **melodia de referência**.
- Pontuação de 0 a 100, combo, precisão e classificação S/A/B/C/D.
- Ranking **local** persistido no navegador, geral e por faixa.
- Faixas sem melodia de referência tocam em **modo livre (sem nota inventada)**.
- Importação temporária de arquivos do próprio dispositivo, para testar música antes de publicar.
- Demonstração instrumental **original**, sintetizada no navegador, sem áudio de terceiros.

## Iniciar em GitHub Pages

1. Acesse **Settings > Pages** neste repositório.
2. Em **Build and deployment > Source**, selecione **GitHub Actions**.
3. O workflow .github/workflows/pages.yml publicará o site automaticamente ao enviar alterações para main.
4. URL prevista após a publicação: https://jonatanoficial-bit.github.io/Karaoke/

O GitHub Pages publica conteúdo **público**: arquivos de áudio adicionados a este repositório poderão ser acessados/baixados. Faça upload apenas de conteúdo para o qual você tenha autorização de hospedagem e distribuição pública. Uma licença para executar músicas nem sempre permite redistribuir cópias no site.

## Adicionar suas próprias músicas

Crie uma subpasta **por música** em songs/, preferencialmente usando nomes simples:

    songs/
      minha-musica/
        instrumental.mp3
        letra.lrc
        melodia.json
        capa.jpg    # opcional

Em seguida acrescente a música no arquivo songs/catalog.json. Modelo:

~~~json
{
  "id": "minha-musica",
  "title": "Minha Música",
  "artist": "Artista Autorizado",
  "genre": "Gospel",
  "audio": "songs/minha-musica/instrumental.mp3",
  "lyrics": "songs/minha-musica/letra.lrc",
  "melody": "songs/minha-musica/melodia.json",
  "cover": "songs/minha-musica/capa.jpg"
}
~~~

O catálogo completo é um **array JSON**; preserve a entrada de demonstração, se desejar. Se não tiver o arquivo de melodia, use "melody": null; o aplicativo oferecerá playback, letras e modo livre, **sem pontuação de afinação**. A opção “Testar música local” não envia arquivos ao GitHub — ela só vale para aquela sessão no navegador.

### Letra .lrc

    [00:00.00]Primeira linha da letra
    [00:04.50]Segunda linha da letra
    [00:09.10]Terceira linha da letra

Cada linha traz o instante em que deve aparecer no palco. Use UTF-8. A pontuação é calculada **pela melodia de referência, não pelo texto**.

### Melodia de referência .json

~~~json
{
  "offsetMs": 0,
  "notes": [
    {"start": 0.0, "end": 0.6, "midi": 60},
    {"start": 0.6, "end": 1.2, "midi": 62},
    {"start": 1.2, "end": 1.8, "midi": 64},
    {"start": 1.8, "end": 2.4, "midi": 67}
  ]
}
~~~

start e end são segundos a partir do início do áudio e midi é o número MIDI da **nota principal cantada** (60 = dó central, 69 = lá de 440 Hz). Para trechos sem voz, não crie notas. Ajuste os tempos manualmente para acompanhar o playback. O arquivo pode ser produzido a partir de uma melodia MIDI (conversão de cada evento para segundos) ou anotado à mão. offsetMs permite um ajuste global, também configurável no palco.

Não basta enviar só MP3: o navegador **não tem como saber a afinação esperada** sem uma referência melódica. Este jogo mede altura aproximada das notas; não avalia timbre, interpretação ou pronúncia. A precisão depende da qualidade do microfone, ruído ambiente, latência e da melodia cadastrada. Ideal cantar com fones de ouvido para evitar que o playback entre no microfone.

## Privacidade e limites

- Microfone é usado **somente no dispositivo**, sem gravação, upload ou transmissão de voz.
- O navegador precisa de **HTTPS** (GitHub Pages atende) e permissão de microfone.
- O ranking é armazenado só neste navegador. Para um ranking online entre usuários seria necessário adicionar um backend autenticado.
- O armazenamento local pode ser apagado pelo usuário e não oferece proteção contra manipulação.
- Música licenciada ou autoral deve ter direitos compatíveis com sua **publicação pública** no repositório.

## Estrutura

- index.html: interface.
- style.css: visual responsivo.
- app.js: player, importação, sincronização LRC, afinação e ranking.
- songs/catalog.json: relação de músicas.
- songs/_MODELO/: modelos de letra e notas para copiar ao adicionar repertório.
- .github/workflows/pages.yml: publicação automática.

© VALE GAMES.