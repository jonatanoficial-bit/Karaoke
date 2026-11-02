# Algo Novo — Kemuel (part. Lukas Agustinho)

## Estado atual

- Letra completa recebida: **77 frases**, armazenadas em `letra-base.txt`.
- Gravação vocal recebida em conversa: **09:10.14** (550,14 segundos).
- Playback recebido em conversa: **06:54.62** (414,62 segundos).
- As gravações têm **durações e arranjos diferentes**; não transferir automaticamente marcações temporais de uma para a outra.
- Áudio do playback **ainda não foi publicado no GitHub**; esta conexão permite enviar arquivos de texto, mas não transferir os MP3 grandes fornecidos no chat.
- Sincronização real por frase **pendente de validação**, não inventar tempos.
- Melodia MIDI de referência para atribuir nota de afinação **não foi fornecida**; até ela existir, modo livre.

## Como concluir a música no karaokê

1. Fazer upload do seu áudio autorizado nesta pasta com o nome exato `instrumental.mp3`. O GitHub Pages expõe esse arquivo publicamente; confirme direitos de redistribuição.
2. Abrir o **Editor de Sincronização** em `sincronizar.html` no GitHub Pages. Selecionar o arquivo de playback *no dispositivo*.
3. Revisar o texto: o áudio instrumental de 6min55s pode omitir trechos da gravação ao vivo de 9min10s. Excluir as frases ausentes.
4. Tocar o playback e marcar o início de cada frase. O aplicativo salva rascunho local e permite correções por décimos de segundo.
5. Baixar `letra.lrc`, verificar a sincronia ouvindo e publicar este arquivo na mesma pasta.
6. Editar `songs/catalog.json`: alterar **ready** para `true` e **lyrics** para `"songs/algo-novo-kemuel/letra.lrc"`.
7. Para pontuação vocal, criar um `melodia.json` com notas MIDI e tempos da linha de voz que correspondam ao playback e configurar a propriedade `melody` do catálogo.

## Direitos e privacidade

A versão cantada enviada serve de referência privada; não é preciso publicá-la. Somente hospede áudio licenciado para **distribuição em site público**. O editor processa o arquivo selecionado no próprio navegador.
