(function () {
    // Verifica se está na página do carrinho
    if (window.location.href !== 'https://www.dufrio.com.br/checkout/cart/') {
        return;
    }

    // Evita injetar o painel mais de uma vez
    if (document.getElementById('dufrio-cart-panel')) return;

    function createCartPanel() {
        const panel = document.createElement('div');
        panel.id = 'dufrio-cart-panel';

        const header = document.createElement('div');
        header.id = 'dufrio-cart-header';

        const titleSpan = document.createElement('span');
        titleSpan.id = 'dufrio-cart-title';
        titleSpan.innerText = '📋 Orçamento WhatsApp';

        const closeBtn = document.createElement('button');
        closeBtn.id = 'dufrio-cart-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => panel.remove();

        header.appendChild(titleSpan);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.id = 'dufrio-cart-content';

        const textArea = document.createElement('textarea');
        textArea.id = 'dufrio-cart-textarea';
        textArea.readOnly = true;
        textArea.style.width = '100%';
        textArea.style.minHeight = '200px';
        textArea.style.padding = '10px';
        textArea.style.border = '1px solid #ddd';
        textArea.style.borderRadius = '4px';
        textArea.style.fontFamily = 'inherit';
        textArea.style.fontSize = '14px';
        textArea.style.resize = 'vertical';

        const copyBtn = document.createElement('button');
        copyBtn.id = 'dufrio-cart-copy-btn';
        copyBtn.innerText = '📋 Copiar Texto';
        copyBtn.style.width = '100%';
        copyBtn.style.marginTop = '10px';
        copyBtn.style.padding = '10px';
        copyBtn.style.backgroundColor = '#28a745';
        copyBtn.style.color = 'white';
        copyBtn.style.border = 'none';
        copyBtn.style.borderRadius = '4px';
        copyBtn.style.cursor = 'pointer';
        copyBtn.style.fontWeight = 'bold';

        content.appendChild(textArea);
        content.appendChild(copyBtn);

        panel.appendChild(header);
        panel.appendChild(content);
        document.body.appendChild(panel);

        return { panel, header, textArea, copyBtn };
    }

    function makeDraggable(panel, handle) {
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        function onPointerDown(e) {
            const target = e.target;
            if (target && (target.id === 'dufrio-cart-close' || target.closest('#dufrio-cart-close'))) return;

            dragging = true;
            const rect = panel.getBoundingClientRect();

            // Troca para posicionamento por left/top para permitir arrastar
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;

            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;

            handle.setPointerCapture?.(e.pointerId);
            e.preventDefault();
        }

        function onPointerMove(e) {
            if (!dragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            const newLeft = startLeft + dx;
            const newTop = startTop + dy;

            const rect = panel.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width - 10;
            const maxTop = window.innerHeight - rect.height - 10;

            panel.style.left = `${clamp(newLeft, 10, maxLeft)}px`;
            panel.style.top = `${clamp(newTop, 10, maxTop)}px`;
        }

        function onPointerUp() {
            dragging = false;
        }

        handle.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    function normalizeCurrency(text) {
        if (!text) return '';
        const match = text.replace(/\u00A0/g, ' ').match(/r\$\s*[\d.,]+/i);
        return match ? match[0].replace(/\s+/g, ' ').trim() : text.trim();
    }

    function normalizeQuantity(text) {
        if (!text) return '';
        const m = String(text).match(/\d+/);
        return m ? m[0] : '';
    }

    function buildItemFromRow(row) {
        const item = {
            name: '',
            image: '',
            unitPrice: '',
            quantity: '',
            subtotal: ''
        };

        // Nome (print mostra data-th="Product" e strong.product-item-name > a.font-medium)
        const nameEl = row.querySelector(
            'td[data-th="Product"] strong.product-item-name a, td[data-th="Produto"] strong.product-item-name a,' +
            'td[data-th="Product"] .product-item-name a, td[data-th="Produto"] .product-item-name a,' +
            'td[data-th="Product"] a.font-medium, td[data-th="Produto"] a.font-medium,' +
            'td[data-th="Product"] strong, td[data-th="Produto"] strong'
        );
        if (nameEl) item.name = nameEl.textContent.trim();

        // Imagem dentro do td Product
        const productCell = row.querySelector('td[data-th="Product"], td[data-th="Produto"]') || row;
        const sourceEl = productCell.querySelector('picture.product-image-photo source');
        if (sourceEl?.srcset) {
            item.image = sourceEl.srcset.split(',')[0].split(' ')[0].trim();
        } else {
            const imgEl = productCell.querySelector('picture.product-image-photo img, img');
            if (imgEl) item.image = imgEl.currentSrc || imgEl.src || imgEl.getAttribute('data-src') || '';
        }

        // Preço unitário
        const unitEl = row.querySelector('td[data-th="Price"] .price, td[data-th="Preço"] .price, td[data-th="Price"], td[data-th="Preço"]');
        if (unitEl) item.unitPrice = normalizeCurrency(unitEl.textContent);

        // Quantidade: input ou texto no cell qty
        const qtyInput = row.querySelector('input[name*="qty"], input[name*="quantity"], input[type="number"]');
        if (qtyInput) {
            item.quantity = normalizeQuantity(qtyInput.value || qtyInput.getAttribute('value'));
        } else {
            const qtyCell = row.querySelector('td.col.qty, td[data-th="Qty"], td[data-th="Quantidade"], td[data-th="Qtd"], td[data-th="qty"]');
            if (qtyCell) item.quantity = normalizeQuantity(qtyCell.textContent);
        }

        // Subtotal
        const subEl = row.querySelector('td[data-th="Subtotal"] .price, td[data-th="Subtotal"], td.col.subtotal, td.col.subtotal .price');
        if (subEl) item.subtotal = normalizeCurrency(subEl.textContent);

        return item;
    }

    function extractCartData() {
        const data = {
            items: [],
            totalQuantity: '',
            // Mantemos um "item selecionado" como padrão (primeiro item) para o botão de imagem
            productImage: '',
            productName: '',
            unitPrice: '',
            quantity: '',
            subtotal: '',
            cep: '',
            deliveryTime: '',
            shippingCost: '',
            totalWithShipping: '',
            pixPrice: '',
            installmentPrice: ''
        };

        try {
            // Itens do carrinho (um ou mais)
            const rows = Array.from(document.querySelectorAll('tr.item-info'));
            if (rows.length > 0) {
                data.items = rows.map(buildItemFromRow).filter(i => i.name || i.unitPrice || i.quantity || i.subtotal);
            } else {
                // Fallback: tenta montar a partir das células Product
                const productCells = Array.from(document.querySelectorAll('td[data-th="Product"], td[data-th="Produto"]'));
                const cellRows = productCells.map(c => c.closest('tr')).filter(Boolean);
                data.items = cellRows.map(buildItemFromRow).filter(i => i.name || i.unitPrice || i.quantity || i.subtotal);
            }

            // Define "padrão" (primeiro item) para compatibilidade com a UI existente
            if (data.items.length > 0) {
                const first = data.items[0];
                data.productName = first.name || '';
                data.productImage = first.image || '';
                data.unitPrice = first.unitPrice || '';
                data.quantity = first.quantity || '';
                data.subtotal = first.subtotal || '';

                const qtySum = data.items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0), 0);
                data.totalQuantity = qtySum ? String(qtySum) : '';
            }

            // 6. CEP (frete) - busca campo de CEP
            const cepInput = document.querySelector('input[name*="cep"], input[name*="postcode"], input[placeholder*="CEP"], input[placeholder*="cep"], input[id*="cep"], input[id*="postcode"]');
            if (cepInput) {
                data.cep = cepInput.value || cepInput.getAttribute('value') || '';
            }

            // 7. Prazo de entrega - busca texto que contenha "dias úteis" ou similar
            const deliverySection = document.querySelector('[class*="frete"], [class*="shipping"], .shipping-method');
            if (deliverySection) {
                const deliveryText = deliverySection.innerText;
                // Tenta pegar apenas os dias úteis (ex: "14 dias úteis" de "Econômico - 14 dias úteis")
                const deliveryMatch = deliveryText.match(/(\d+)\s*dias?\s*úteis?/i);
                if (deliveryMatch) {
                    data.deliveryTime = `${deliveryMatch[1]} dias úteis`;
                } else {
                    // Fallback: tenta pegar qualquer texto que contenha prazo
                    const allText = document.body.innerText;
                    const prazoMatch = allText.match(/prazo\s+de\s+entrega[:\s]+(.+?)(?:\n|$)/i);
                    if (prazoMatch) {
                        const prazoText = prazoMatch[1].trim();
                        const daysMatch = prazoText.match(/(\d+)\s*dias?\s*úteis?/i);
                        if (daysMatch) {
                            data.deliveryTime = `${daysMatch[1]} dias úteis`;
                        } else {
                            data.deliveryTime = prazoText;
                        }
                    }
                }
            }

            // 8. Valor do frete - busca próximo ao prazo de entrega
            if (deliverySection) {
                const shippingPriceEl = deliverySection.querySelector('.price, .price-wrapper, [class*="price"]');
                if (shippingPriceEl) {
                    const shippingText = shippingPriceEl.innerText.trim();
                    const shippingMatch = shippingText.match(/r\$\s*[\d.,]+/i);
                    if (shippingMatch) {
                        data.shippingCost = shippingMatch[0];
                    } else {
                        data.shippingCost = shippingText;
                    }
                } else {
                    // Busca no texto completo da seção
                    const shippingText = deliverySection.innerText;
                    const shippingMatch = shippingText.match(/r\$\s*[\d.,]+/g);
                    if (shippingMatch && shippingMatch.length > 0) {
                        // Pega o último valor encontrado (geralmente é o frete)
                        data.shippingCost = shippingMatch[shippingMatch.length - 1];
                    }
                }
            }

            // 9. Total dos produtos e Total com frete - busca na seção RESUMO
            const summarySection = document.querySelector('.summary, .cart-summary, [class*="resumo"], [class*="summary"]');
            if (summarySection) {
                const summaryText = summarySection.innerText;
                
                // Busca "Subtotal" ou "Total dos produtos" primeiro
                const subtotalLabels = summarySection.querySelectorAll('td, .label, span, div, strong');
                for (const label of subtotalLabels) {
                    const labelText = label.innerText.toLowerCase();
                    if ((labelText.includes('subtotal') || labelText.includes('total dos produtos')) && labelText.includes('r$')) {
                        const priceMatch = label.innerText.match(/r\$\s*[\d.,]+/i);
                        if (priceMatch) {
                            // Armazena como subtotal geral (será usado para calcular total dos produtos)
                            data.subtotal = priceMatch[0];
                            break;
                        }
                    }
                }
                
                // Estratégia melhorada: busca o valor que vem DEPOIS do frete na seção RESUMO
                // Procura por elementos que contenham "Total" mas não "Subtotal" ou "PIX"
                const allRows = summarySection.querySelectorAll('tr, div[class*="row"], div[class*="item"]');
                let foundFrete = false;
                
                for (const row of allRows) {
                    const rowText = row.innerText.toLowerCase();
                    
                    // Marca quando encontra frete
                    if (rowText.includes('frete') && rowText.includes('r$')) {
                        foundFrete = true;
                        continue;
                    }
                    
                    // Se já encontrou frete, procura o próximo "Total" que não seja subtotal
                    if (foundFrete && rowText.includes('total') && !rowText.includes('subtotal') && !rowText.includes('pix')) {
                        const priceMatch = row.innerText.match(/r\$\s*[\d.,]+/i);
                        if (priceMatch) {
                            data.totalWithShipping = priceMatch[0].trim();
                            break;
                        }
                    }
                }
                
                // Fallback: busca todos os elementos procurando pelo último "Total" que não seja subtotal
                if (!data.totalWithShipping) {
                    const allElements = Array.from(summarySection.querySelectorAll('*'));
                    let lastTotal = null;
                    
                    for (const el of allElements) {
                        const text = el.innerText.toLowerCase().trim();
                        if (text.includes('total') && 
                            !text.includes('subtotal') && 
                            !text.includes('produtos') &&
                            !text.includes('pix') &&
                            text.includes('r$')) {
                            const match = el.innerText.match(/r\$\s*[\d.,]+/i);
                            if (match) {
                                lastTotal = match[0].trim();
                            }
                        }
                    }
                    
                    if (lastTotal) {
                        data.totalWithShipping = lastTotal;
                    }
                }
                
                // Último fallback: busca no texto completo
                if (!data.totalWithShipping) {
                    const lines = summaryText.split('\n');
                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i];
                        const lowerLine = line.toLowerCase();
                        if (lowerLine.includes('total') && 
                            !lowerLine.includes('subtotal') && 
                            !lowerLine.includes('produtos') &&
                            !lowerLine.includes('pix')) {
                            const match = line.match(/r\$\s*[\d.,]+/i);
                            if (match) {
                                data.totalWithShipping = match[0].trim();
                                break;
                            }
                        }
                    }
                }
            }

            // 10. Valor à vista no PIX - busca na seção RESUMO
            if (summarySection) {
                const pixElements = summarySection.querySelectorAll('*');
                for (const el of pixElements) {
                    const text = el.innerText.toLowerCase();
                    if (text.includes('pix') && text.includes('r$')) {
                        // Tenta pegar o valor completo incluindo "no PIX" se houver
                        const pixMatch = el.innerText.match(/r\$\s*[\d.,]+(?:\s*no\s*pix)?/gi);
                        if (pixMatch && pixMatch.length > 0) {
                            // Pega o primeiro valor encontrado e normaliza
                            data.pixPrice = pixMatch[0].trim();
                            break;
                        }
                    }
                }
            }

            // 11. Valor parcelado - busca na seção RESUMO
            if (summarySection) {
                const installmentElements = summarySection.querySelectorAll('*');
                for (const el of installmentElements) {
                    const text = el.innerText.toLowerCase();
                    if ((text.includes('ou r$') || text.includes('parcelado')) && (text.includes('em') || text.includes('x'))) {
                        const installmentMatch = el.innerText.match(/ou\s+r\$\s*[\d.,]+\s+em\s+\d+\s*x\s+de\s+r\$\s*[\d.,]+/i);
                        if (installmentMatch) {
                            data.installmentPrice = installmentMatch[0];
                            break;
                        }
                    }
                }
            }

            // Se não encontrou parcelado, busca em todo o documento
            if (!data.installmentPrice) {
                const allText = document.body.innerText;
                const installmentMatch = allText.match(/ou\s+r\$\s*[\d.,]+\s+em\s+\d+\s*x\s+de\s+r\$\s*[\d.,]+(?:\s+sem\s+juros)?/i);
                if (installmentMatch) {
                    data.installmentPrice = installmentMatch[0];
                }
            }

        } catch (error) {
            console.error('Erro ao extrair dados do carrinho:', error);
        }

        return data;
    }

    function parseCurrencyValue(text) {
        if (!text) return 0;
        const match = text.replace(/\s+/g, '').match(/[\d.,]+/);
        if (!match) return 0;
        return parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
    }

    function formatCurrency(value) {
        if (typeof value === 'string') {
            const num = parseCurrencyValue(value);
            return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function extractDeliveryDays(text) {
        if (!text) return '';
        const match = text.match(/(\d+)\s*dias?\s*úteis?/i);
        return match ? `${match[1]} dias úteis` : text;
    }

    function extractInstallmentInfo(text) {
        if (!text) return '';
        const match = text.match(/em\s+(\d+)\s*x\s+de\s+r\$\s*([\d.,]+)/i);
        if (match) {
            return `em ${match[1]} x de R$ ${match[2]}`;
        }
        return '';
    }

    function formatWhatsAppText(data) {
        let text = '';

        // Título
        text += `*Orçamento - Dufrio*\n\n`;

        // Lista de produtos
        if (data.items && data.items.length > 0) {
            data.items.forEach((item) => {
                if (item.name) {
                    text += `*${item.name}*\n`;
                }
                if (item.quantity) {
                    text += `📦 Qtd: ${item.quantity}\n`;
                }
                if (item.subtotal) {
                    text += `💵 Subtotal: ${item.subtotal}\n`;
                }
                text += `\n`;
            });

            // Total dos produtos (usa subtotal geral se disponível, senão soma os subtotais individuais)
            let totalProducts = 0;
            if (data.subtotal) {
                totalProducts = parseCurrencyValue(data.subtotal);
            } else {
                data.items.forEach(item => {
                    if (item.subtotal) {
                        totalProducts += parseCurrencyValue(item.subtotal);
                    }
                });
            }
            if (totalProducts > 0) {
                text += `💵 *Total dos produtos*: R$ ${formatCurrency(totalProducts)}\n\n`;
            }
        } else {
            // Fallback para carrinho com 1 item (caso seletores falhem)
            if (data.productName) {
                text += `*${data.productName}*\n`;
            }
            if (data.quantity) {
                text += `📦 Qtd: ${data.quantity}\n`;
            }
            if (data.subtotal) {
                text += `💵 Subtotal: ${data.subtotal}\n`;
                text += `\n`;
                // Tenta calcular total dos produtos
                const totalProducts = parseCurrencyValue(data.subtotal);
                if (totalProducts > 0) {
                    text += `💵 *Total dos produtos*: R$ ${formatCurrency(totalProducts)}\n\n`;
                }
            }
        }

        // Seção de frete
        if (data.cep || data.shippingCost || data.deliveryTime) {
            if (data.cep) {
                text += `🚚 Frete para o CEP: ${data.cep}\n`;
            }
            if (data.shippingCost) {
                text += `💵 Valor: ${data.shippingCost}\n`;
            }
            if (data.deliveryTime) {
                const deliveryDays = extractDeliveryDays(data.deliveryTime);
                text += `⏰ Prazo de entrega: ${deliveryDays}\n`;
            }
            text += `\n`;
        }

        // Total com frete (com informação de parcelamento se disponível)
        if (data.totalWithShipping) {
            let totalText = `💳 *Total com frete:* ${data.totalWithShipping}`;
            if (data.installmentPrice) {
                const installmentInfo = extractInstallmentInfo(data.installmentPrice);
                if (installmentInfo) {
                    totalText += ` ${installmentInfo}`;
                }
            }
            text += `${totalText}\n\n`;
        }

        // Valor PIX
        if (data.pixPrice) {
            // Remove "no PIX" se estiver no texto e normaliza
            let pixValue = data.pixPrice.replace(/\s*no\s*pix/gi, '').trim();
    async function copyImageToClipboard(imageUrl) {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            const imageBitmap = await createImageBitmap(blob);
            const canvas = document.createElement('canvas');
            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(imageBitmap, 0, 0);
            
            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("Falha ao gerar blob");
                
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);
                
                const btn = document.getElementById('dufrio-cart-copy-image-btn');
                const originalText = btn.innerText;
                btn.innerText = '✅ Imagem Copiada!';
                btn.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.style.backgroundColor = '#0056b3';
                }, 2000);
            }, "image/png");
        } catch (error) {
            console.error('Erro ao copiar imagem:', error);
            // Fallback: copia URL
            navigator.clipboard.writeText(imageUrl).then(() => {
                const btn = document.getElementById('dufrio-cart-copy-image-btn');
                const originalText = btn.innerText;
                btn.innerText = '✅ URL Copiada!';
                btn.style.backgroundColor = '#ffc107';
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.style.backgroundColor = '#0056b3';
                }, 2000);
            });
        }
    }
            // Garante que está no formato R$ X,XX
            const pixMatch = pixValue.match(/r\$\s*[\d.,]+/i);
            if (pixMatch) {
                pixValue = pixMatch[0];
            }
            text += `💸 *Valor à vista no PIX:* ${pixValue}\n`;
        }

        return text.trim();
    }


    function init() {
        const { panel, header, textArea, copyBtn } = createCartPanel();
        let cartData = null;

        makeDraggable(panel, header);

        // Aguarda um pouco para garantir que a página carregou completamente
        setTimeout(() => {
            cartData = extractCartData();
            let formattedText = formatWhatsAppText(cartData);

            // Verifica se encontrou informações básicas
            const hasBasicInfo =
                (cartData.items && cartData.items.length > 0) ||
                cartData.productName ||
                cartData.unitPrice ||
                cartData.subtotal;
            if (!hasBasicInfo) {
                formattedText = '⚠️ Não foi possível extrair todas as informações do carrinho.\n\nPor favor, certifique-se de que:\n- O carrinho possui produtos\n- A página está totalmente carregada\n\nTente atualizar a página e abrir novamente.';
            } else if (!formattedText || formattedText.trim().length === 0) {
                formattedText = '⚠️ Algumas informações podem estar faltando. Verifique se o carrinho está completo.';
            }
            
            textArea.value = formattedText;

            // Botão copiar texto
            copyBtn.onclick = () => {
                textArea.select();
                const textToCopy = textArea.value;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = copyBtn.innerText;
                    copyBtn.innerText = '✅ Texto Copiado!';
                    copyBtn.style.backgroundColor = '#28a745';
                    setTimeout(() => {
                        copyBtn.innerText = originalText;
                        copyBtn.style.backgroundColor = '#28a745';
                    }, 2000);
                });
            };
        }, 1500);

        // Observa mudanças no DOM para atualizar quando o carrinho mudar
        const observer = new MutationObserver(() => {
            setTimeout(() => {
                cartData = extractCartData();
                const formattedText = formatWhatsAppText(cartData);
                textArea.value = formattedText;
            }, 500);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Dispara quando a página estiver pronta
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();
