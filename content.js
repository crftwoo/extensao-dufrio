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

        const copyListBtn = document.createElement('button');
        copyListBtn.id = 'dufrio-ext-copy-list';
        copyListBtn.innerText = 'Copiar Lista 📋';
        copyListBtn.onclick = () => {
            if (currentProductsList.length === 0) return;

            const fullTitle = currentListTitle || generateSmartTitle(currentProductsList);

            // Monta o texto de todos os produtos separados por linha (quebrando linhas ao invés da linha contínua)
            const listText = currentProductsList.map(p => formatProductText(p.title, p.spot, p.install)).join('\n\n\n');
            const textToCopy = `*${fullTitle}*\n\n${listText}`;

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

    function generateSmartTitle(productsList) {
        if (!productsList || productsList.length === 0) return 'Ar condicionado - Dufrio';

        let minBtu = Infinity;
        let maxBtu = -Infinity;
        let hasQuenteFrio = false;
        let hasSoFrio = false;
        let allInverter = true;
        let typesFound = new Set();

        productsList.forEach(p => {
            const titleStr = p.title.toLowerCase();

            // Extrai BTUs (ex: 9000, 9.000, 12000)
            const btuMatch = titleStr.match(/(\d{1,2}\.?\d{3})\s*btus?/);
            if (btuMatch) {
                const btuVal = parseInt(btuMatch[1].replace('.', ''), 10);
                if (btuVal < minBtu) minBtu = btuVal;
                if (btuVal > maxBtu) maxBtu = btuVal;
            }

            // Identifica o Ciclo
            if (titleStr.includes('quente/frio') || titleStr.includes('quente e frio') || titleStr.includes('quente/ frio') || titleStr.includes('quente / frio') || titleStr.includes('quente frio') || titleStr.includes('q/f')) {
                hasQuenteFrio = true;
            } else if (titleStr.includes('frio')) {
                hasSoFrio = true;
            }

            // Verifica se todos são Inverter
            if (!titleStr.includes('inverter')) {
                allInverter = false;
            }

            // Identifica o Tipo
            if (titleStr.includes('piso') && titleStr.includes('teto')) {
                typesFound.add('Piso Teto');
            } else if (titleStr.includes('cassete')) {
                typesFound.add('Cassete');
            } else if (titleStr.includes('janela')) {
                typesFound.add('de Janela');
            } else if (titleStr.includes('portátil') || titleStr.includes('portatil')) {
                typesFound.add('Portátil');
            } else if (titleStr.includes('multi')) {
                typesFound.add('Multi Split');
            } else if (titleStr.includes('split') || titleStr.includes('hiwall') || titleStr.includes('hi-wall') || titleStr.includes('hi wall')) {
                typesFound.add('Split');
            }
        });

        let btuString = "";
        if (minBtu !== Infinity && maxBtu !== -Infinity) {
            if (minBtu === maxBtu) {
                btuString = `${minBtu} BTUs`;
            } else {
                btuString = `${minBtu} a ${maxBtu} BTUs`;
            }
        }

        let cicloString = "";
        let titleEmoji = "";
        if (hasQuenteFrio && !hasSoFrio) {
            cicloString = "Quente/Frio";
            titleEmoji = "🔥❄️ ";
        } else if (hasSoFrio && !hasQuenteFrio) {
            cicloString = "Frio";
            titleEmoji = "❄️ ";
        }

        let parts = [];
        if (typesFound.size === 1) {
            parts.push(Array.from(typesFound)[0]);
        } else {
            parts.push("Ar Condicionado");
        }

        if (allInverter) parts.push("Inverter");
        if (btuString) parts.push(btuString);
        if (cicloString) parts.push(cicloString);

        return `${titleEmoji} ${parts.join(" · ")}`;
    }

    function formatProductText(title, spot, install) {
        let emojiCycle = "❄️";
        const titleLower = title.toLowerCase();
        if (titleLower.includes('quente/frio') || titleLower.includes('quente e frio') || titleLower.includes('quente/ frio') || titleLower.includes('quente / frio') || titleLower.includes('quente frio') || titleLower.includes('q/f')) {
            emojiCycle = "🔥❄️";
        }
        return `${emojiCycle} ${title}\n💰 ${spot}\n💳 ${install}`;
    }

    function renderProducts(contentDiv, products) {
        if (products.length === 0) {
            contentDiv.innerHTML = '<p style="text-align:center;color:#666;">Nenhum ar condicionado encontrado ainda. A página pode estar carregando...</p>';
            return;
        }

        // Atualiza a lista global para o botão Copiar Lista
        currentProductsList = products;

        // Atualiza o título no cabeçalho da extensão com as métricas inteligentes
        const headerTitleSpan = document.getElementById('dufrio-ext-main-title');
        if (headerTitleSpan) {
            headerTitleSpan.innerText = currentListTitle || generateSmartTitle(products);
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

    let currentListTitle = null;

    function init() {
        chrome.storage.local.get(['lastSearchTitle'], (result) => {
            if (result.lastSearchTitle) {
                currentListTitle = result.lastSearchTitle;
            }

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
        });
    }

    // Dispara
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();