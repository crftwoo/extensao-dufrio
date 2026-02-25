(function () {
    // Evita injetar o painel mais de uma vez
    if (document.getElementById('dufrio-ext-panel')) return;

    // Variável global para guardar a lista atual de produtos para o botão 'Copiar Lista'
    let currentProductsList = [];

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'dufrio-ext-panel';

        const header = document.createElement('div');
        header.id = 'dufrio-ext-header';

        const titleArea = document.createElement('div');
        titleArea.style.display = 'flex';
        titleArea.style.flexDirection = 'column';
        titleArea.style.gap = '5px';

        const titleSpan = document.createElement('span');
        titleSpan.id = 'dufrio-ext-main-title';
        titleSpan.innerText = 'Ar condicionado - Dufrio';
        titleSpan.style.whiteSpace = 'pre-line';

        const copyListBtn = document.createElement('button');
        copyListBtn.id = 'dufrio-ext-copy-list';
        copyListBtn.innerText = 'Copiar Lista 📋';
        copyListBtn.onclick = () => {
            if (currentProductsList.length === 0) return;

            const fullTitle = generateSmartTitle(currentProductsList);

            // Monta o texto de todos os produtos separados por linha (quebrando linhas ao invés da linha contínua)
            const listText = currentProductsList.map(p => formatProductText(p.title, p.spot, p.install)).join('\n\n\n');
            const titleText = fullTitle.split('\n').map(l => `*${l}*`).join('\n');
            const textToCopy = `${titleText}\n\n${listText}`;

            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = copyListBtn.innerText;
                copyListBtn.innerText = 'Lista Copiada! ✔️';
                setTimeout(() => copyListBtn.innerText = originalText, 2000);
            });
        };

        titleArea.appendChild(titleSpan);
        titleArea.appendChild(copyListBtn);

        const closeBtn = document.createElement('button');
        closeBtn.id = 'dufrio-ext-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => panel.remove();

        header.appendChild(titleArea);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.id = 'dufrio-ext-content';
        content.innerHTML = '<p style="text-align:center;">Buscando produtos...</p>';

        panel.appendChild(header);
        panel.appendChild(content);
        document.body.appendChild(panel);

        return content;
    }

    function extractData() {
        const products = [];
        const seenTitles = new Set();

        // Pelas imagens do usuário, podemos encontrar os produtos localizando os títulos
        // Cada título tem a classe específica 'product-item-link' e é um 'a'
        const titleLinks = document.querySelectorAll('a.product-item-link');

        if (titleLinks.length === 0) {
            console.log("Dufrio Extrator: Nenhum a.product-item-link encontrado na tela.");
            return products;
        }

        titleLinks.forEach(titleLink => {
            try {
                // O texto exato do título do produto
                const titleStr = titleLink.innerText.trim();

                // Ignorar se não for ar condicionado
                if (!titleStr.toLowerCase().includes('ar condicionado') && !titleStr.toLowerCase().includes('split')) {
                    return;
                }

                // A partir do título, subimos na árvore até encontrar o card do produto inteiro.
                // Na Dufrio, ele costuma ficar num 'li.item.product.product-item' ou numa 'div' que envelopa a foto e a info.
                // Vamos subir até achar alguém que tem a '.product-image-photo' (que é a imagem)
                const card = titleLink.closest('.product-item') || titleLink.closest('[class*="product-info"]').parentElement;

                if (!card) return;

                // 1. Pega imagem exata
                const imgEl = card.querySelector('img.product-image-photo, img.product-image');
                if (!imgEl) return;

                let imgSrc = imgEl.src || imgEl.getAttribute('data-src') || '';

                // Às vezes o srcset tem a imagem boa
                if (!imgSrc || imgSrc.includes('data:image')) {
                    const sourceEl = card.querySelector('source');
                    if (sourceEl && sourceEl.srcset) {
                        imgSrc = sourceEl.srcset.split(',')[0].split(' ')[0]; // pega a primeira url do srcset
                    }
                }

                if (!imgSrc || imgSrc.includes('data:image')) return;

                // 2. Extrai o Valor à Vista exato
                let spotLine = "";

                // Tenta extrair primeiro da nova classe spot-price que costuma ter o PIX
                const spotPriceEl = card.querySelector('.spot-price');
                if (spotPriceEl) {
                    spotLine = spotPriceEl.innerText.replace(/\s+/g, ' ').trim();
                }

                // Se não achar o .spot-price, faz o fallback para o sistema antigo
                if (!spotLine) {
                    let realPriceEl = card.querySelector('#cash_down');

                    if (!realPriceEl) {
                        const mainPriceContainer = card.querySelector('.discount-price') || card.querySelector('.main-price');
                        if (mainPriceContainer) {
                            realPriceEl = mainPriceContainer.querySelector('.price-wrapper');
                        }
                    }

                    if (!realPriceEl) {
                        const allWrappers = card.querySelectorAll('.price-wrapper');
                        if (allWrappers.length > 0) realPriceEl = allWrappers[allWrappers.length - 1];
                    }

                    if (realPriceEl && realPriceEl.innerText.includes('R$')) {
                        spotLine = realPriceEl.innerText.replace(/\s+/g, ' ').trim();

                        const siblingLabel = realPriceEl.parentElement ? realPriceEl.parentElement.querySelector('.price-label') : null;
                        const anyLabel = card.querySelector('.price-label');
                        const labelToUse = siblingLabel || anyLabel;

                        if (labelToUse) {
                            const labelText = labelToUse.innerText.replace(/\s+/g, ' ').trim();
                            if (!spotLine.includes(labelText)) {
                                spotLine += ' ' + labelText;
                            }
                        }
                    }
                }

                // 3. Extrai o Valor Parcelado exato
                // Vimos na imagem que ele fica num <p> logo abaixo do price container
                let installLine = "";
                // Tenta achar um <p> filho do card inteiro que contenha "ou R$" e "em"
                const ps = card.querySelectorAll('p');
                ps.forEach(p => {
                    const pText = p.innerText.toLowerCase();
                    if (pText.includes('ou r$') && (pText.includes('em') || pText.includes('x'))) {
                        installLine = p.innerText.replace(/\s+/g, ' ').trim(); // Limpa espaços e pulos de linha
                    }
                });

                // Se não encontrou preço, ignora o produto inteiramente (ex: indisponível/avise-me)
                if (!spotLine || !installLine) return;

                // Previne produtos duplicados na listagem
                if (!seenTitles.has(titleStr)) {
                    seenTitles.add(titleStr);
                    products.push({
                        title: titleStr,
                        image: imgSrc,
                        spot: spotLine,
                        install: installLine
                    });
                }
            } catch (e) { console.error('Dufrio Extrator Erro num card específico:', e); }
        });

        return products;
    }

    function extractProductInfo(titleStr) {
        const titleLower = titleStr.toLowerCase();

        let btuVal = null;
        const btuMatch = titleLower.match(/(\d{1,2}\.?\d{3})\s*btus?/);
        if (btuMatch) {
            btuVal = parseInt(btuMatch[1].replace('.', ''), 10);
        }

        const isQF = titleLower.includes('quente/frio') || titleLower.includes('quente e frio') || titleLower.includes('quente/ frio') || titleLower.includes('quente / frio') || titleLower.includes('quente frio') || titleLower.includes('q/f');
        const isSF = titleLower.includes('frio') && !isQF;

        let type = 'Ar Condicionado';
        if (titleLower.includes('teto')) {
            type = 'Piso Teto';
        } else if (titleLower.includes('cassete')) {
            type = 'Cassete';
        } else if (titleLower.includes('janela')) {
            type = 'de Janela';
        } else if (titleLower.includes('portátil') || titleLower.includes('portatil')) {
            type = 'Portátil';
        } else if (titleLower.includes('multi')) {
            type = 'Multi Split';
        } else if (titleLower.includes('split') || titleLower.includes('hiwall') || titleLower.includes('hi-wall') || titleLower.includes('hi wall')) {
            type = 'Hiwall';
        }

        return { btuVal, isQF, isSF, type };
    }

    function generateSmartTitle(productsList) {
        if (!productsList || productsList.length === 0) return 'Ar condicionado - Dufrio';

        const typesStats = {};

        productsList.forEach(p => {
            const info = extractProductInfo(p.title);
            if (!typesStats[info.type]) {
                typesStats[info.type] = { minBtu: Infinity, maxBtu: -Infinity, hasQF: false, hasSF: false };
            }
            if (info.btuVal) {
                if (info.btuVal < typesStats[info.type].minBtu) typesStats[info.type].minBtu = info.btuVal;
                if (info.btuVal > typesStats[info.type].maxBtu) typesStats[info.type].maxBtu = info.btuVal;
            }
            if (info.isQF) typesStats[info.type].hasQF = true;
            if (info.isSF) typesStats[info.type].hasSF = true;
        });

        const orderedTypes = ['Hiwall', 'Piso Teto', 'Cassete', 'de Janela', 'Portátil', 'Multi Split', 'Ar Condicionado'];
        const formatInt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

        let titleLines = [];

        orderedTypes.forEach(t => {
            if (typesStats[t]) {
                const stats = typesStats[t];
                let btuString = "";
                if (stats.minBtu !== Infinity && stats.maxBtu !== -Infinity) {
                    if (stats.minBtu === stats.maxBtu) {
                        btuString = `${formatInt(stats.minBtu)} Btus`;
                    } else {
                        btuString = `${formatInt(stats.minBtu)} a ${formatInt(stats.maxBtu)} Btus`;
                    }
                }

                let cicloString = "";
                let emoji = "";

                if (stats.hasQF && stats.hasSF) {
                    cicloString = ""; // Sem emoji e sem ciclo se houver os dois na mesma matriz de tipo
                    emoji = "";
                } else if (stats.hasQF) {
                    cicloString = "Quente/Frio";
                    emoji = "🔥❄️ ";
                } else if (stats.hasSF) {
                    cicloString = "Só Frio";
                    emoji = "❄️ ";
                }

                const parts = [t];
                if (btuString) parts.push(btuString);
                if (cicloString) parts.push(cicloString);

                titleLines.push(`${emoji}${parts.join(' · ')}`.trim());
            }
        });

        return titleLines.join('\n');
    }

    function formatProductText(title, spot, install) {
        let emojiCycle = "❄️"; // Default Só Frio
        const titleLower = title.toLowerCase();
        if (titleLower.includes('quente/frio') || titleLower.includes('quente e frio') || titleLower.includes('quente/ frio') || titleLower.includes('quente / frio') || titleLower.includes('quente frio') || titleLower.includes('q/f')) {
            emojiCycle = "🔥❄️";
        }
        return `${emojiCycle} ${title}\n💰 ${spot}\n💳 ${install}`;
    }

    function parseSpotPrice(priceStr) {
        if (!priceStr) return Infinity;
        const match = priceStr.match(/R\$\s*([\d\.,]+)/);
        if (match) {
            let numStr = match[1].replace(/\./g, '').replace(',', '.');
            return parseFloat(numStr) || Infinity;
        }
        return Infinity;
    }

    function renderProducts(contentDiv, products) {
        if (products.length === 0) {
            contentDiv.innerHTML = '<p style="text-align:center;color:#666;">Nenhum ar condicionado encontrado ainda. A página pode estar carregando...</p>';
            return;
        }

        // Ordena os produtos do menor para o maior preço à vista
        products.sort((a, b) => parseSpotPrice(a.spot) - parseSpotPrice(b.spot));

        // Atualiza a lista global para o botão Copiar Lista
        currentProductsList = products;

        // Atualiza o título no cabeçalho da extensão com as métricas inteligentes
        const headerTitleSpan = document.getElementById('dufrio-ext-main-title');
        if (headerTitleSpan) {
            headerTitleSpan.innerText = generateSmartTitle(products);
        }

        contentDiv.innerHTML = '';
        products.forEach((p, index) => {
            const card = document.createElement('div');
            card.className = 'dufrio-ext-card';

            const img = document.createElement('img');
            img.src = p.image;

            // Container para todo o texto (título + preço à vista + preço parcelado)
            const textContainer = document.createElement('div');
            textContainer.className = 'dufrio-ext-text-container';
            textContainer.style.cursor = 'pointer';
            textContainer.title = 'Clique para copiar o texto inteiro';

            const title = document.createElement('div');
            title.className = 'dufrio-ext-title';
            title.innerText = p.title;

            const spot = document.createElement('div');
            spot.className = 'dufrio-ext-spot';
            spot.innerText = p.spot;

            const install = document.createElement('div');
            install.className = 'dufrio-ext-install';
            install.innerText = p.install;

            textContainer.appendChild(title);
            textContainer.appendChild(spot);
            textContainer.appendChild(install);

            // Copiar texto ao clicar nele
            textContainer.onclick = () => {
                const textToCopy = formatProductText(p.title, p.spot, p.install);
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalBg = textContainer.style.backgroundColor;
                    textContainer.style.backgroundColor = '#d4edda'; // Verde clarinho de sucesso
                    setTimeout(() => textContainer.style.backgroundColor = originalBg, 500);
                });
            };

            // Copiar imagem ao clicar nela
            img.style.cursor = 'pointer';
            img.title = 'Clique para copiar a imagem';
            img.crossOrigin = "Anonymous"; // Importante para tentar burlar CORS interno do Chrome

            img.onclick = async () => {
                try {
                    // Criar um canvas para desenhar a imagem e extrair os pixels
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext('2d');

                    // Fundo branco para garantir que transparências fiquem com fundo (ex: jpg/png no WhatsApp)
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);

                    // Converter canvas para Blob PNG (formato recomendado para área de transferência)
                    canvas.toBlob(blob => {
                        if (!blob) throw new Error("Falha ao gerar blob do canvas");

                        const item = new ClipboardItem({ "image/png": blob });
                        navigator.clipboard.write([item]).then(() => {
                            const originalBorder = img.style.border;
                            img.style.border = '3px solid #28a745'; // Borda verde indicando sucesso
                            setTimeout(() => img.style.border = originalBorder, 500);
                        }).catch(err => {
                            console.error("Erro no write do clipboard:", err);
                            fallbackCopyUrl();
                        });
                    }, "image/png");

                } catch (err) {
                    console.error('Falha ao tentar usar canvas, tentando fetch/fallback...', err);
                    fallbackCopyUrl();
                }

                function fallbackCopyUrl() {
                    navigator.clipboard.writeText(p.image).then(() => {
                        const originalBorder = img.style.border;
                        img.style.border = '3px solid #ffc107'; // Borda amarela indicando sucesso com fallback (URL)
                        setTimeout(() => img.style.border = originalBorder, 500);
                    });
                }
            };

            card.appendChild(img);
            card.appendChild(textContainer);

            contentDiv.appendChild(card);
        });
    }

    function init() {
        const contentDiv = createPanel();

        // Timeout longo para garantir que preços via JS carregaram (ex: "x-data='initPriceBox...'")
        setTimeout(() => {
            const products = extractData();
            renderProducts(contentDiv, products);
        }, 1500);

        // Opcional: recarregar as buscas se rolar até o fim da página
        let lastScrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(lastScrollTimeout);
            lastScrollTimeout = setTimeout(() => {
                const products = extractData();
                if (products.length > (document.querySelectorAll('.dufrio-ext-card').length)) { // Só atualiza se achou mais
                    renderProducts(document.getElementById('dufrio-ext-content'), products);
                }
            }, 1000);
        });
    }

    // Dispara
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();