function parseEnergyCost(costStr) {
    if (!costStr) return {};
    
    const costs = {};
    const energyMatches = costStr.match(/[RGWLFPDCM]/g) || [];
    
    energyMatches.forEach(energy => {
        costs[energy] = (costs[energy] || 0) + 1;
    });
    
    return costs;
}

function parseAttack(attackLine) {
    if (!attackLine) return null;
    
    const damageMatch = attackLine.match(/(\d+)([+x])?/);
    let baseDamage = 0;
    let effect = null;
    let text = attackLine.trim();

    if (damageMatch) {
        baseDamage = parseInt(damageMatch[1]);
        if (damageMatch[2] === 'x') {
            effect = 'multiply';
        } else if (damageMatch[2] === '+') {
            effect = 'bonus';
        }
    }

    // Common effects
    if (text.includes('Asleep')) effect = 'sleep';
    if (text.includes('Paralyzed')) effect = 'paralyze';
    if (text.includes('Poisoned')) effect = 'poison';
    if (text.includes('Heal')) effect = 'heal';
    if (text.includes('Flip')) effect = 'flip';
    if (text.includes('Energy Zone')) effect = 'energyZone';
    if (text.includes('discard')) effect = 'discard';

    return {
        baseDamage,
        effect,
        text: text.split('\n')[0]  // Take only first line of text
    };
}

function parseCardBlock(lines, startIndex) {
    let currentIndex = startIndex;
    const cardLines = [];
    
    // Collect all lines for this card until we hit the next card marker or end
    while (currentIndex < lines.length) {
        const line = lines[currentIndex].trim();
        if (currentIndex > startIndex && (line.match(/^A1[a]? #\d+$/) || line.match(/^P-A #\d+$/))) {
            break;
        }
        if (line) {
            cardLines.push(line);
        }
        currentIndex++;
    }

    // Parse the card details
    const nameTypeLine = cardLines[0].split(' - ');
    const name = nameTypeLine[0];
    const [type, hpStr] = (nameTypeLine[1] || '').split(' ');
    const hp = hpStr ? parseInt(hpStr.replace(' HP', '')) : 0;

    const card = {
        name,
        type,
        hp,
        category: cardLines[1]?.split(' - ')[0] || 'Pokémon',
        evolution: {
            stage: 'Basic',
            evolvesFrom: null
        },
        attacks: [],
        abilities: [],
        weakness: null,
        retreatCost: 0,
        damage: 0,
        status: null,
        attachedEnergy: [],
        isEx: name.toLowerCase().endsWith('ex')
    };

    // Process each line
    for (let i = 1; i < cardLines.length; i++) {
        const line = cardLines[i];
        
        if (line.startsWith('Ability:')) {
            const [abilityName, ...abilityText] = line.substring(9).split('\n');
            card.abilities.push({
                name: abilityName,
                effect: abilityText.join(' ').trim()
            });
            continue;
        }

        // Evolution information
        if (line.includes('Evolves from')) {
            card.evolution.stage = line.includes('Stage 2') ? 'Stage 2' : 'Stage 1';
            card.evolution.evolvesFrom = line.split('Evolves from ')[1];
            continue;
        }

        // Attack
        if (line.match(/^[RGWLFPDCM]+\s/)) {
            const [costStr, ...attackParts] = line.split(' ');
            const attackText = attackParts.join(' ');
            const attackName = attackText.split(/\d/).shift().trim();
            const attackInfo = parseAttack(attackText.substring(attackName.length));

            if (attackName && attackInfo) {
                card.attacks.push({
                    name: attackName,
                    cost: parseEnergyCost(costStr),
                    ...attackInfo
                });
            }
            continue;
        }

        // Weakness and Retreat
        if (line.startsWith('Weakness:')) {
            const [weakness, retreat] = line.split('Retreat:');
            card.weakness = weakness.replace('Weakness:', '').trim();
            card.retreatCost = parseInt(retreat);
        }
    }

    return [card, currentIndex];
}

// Process the entire card library
async function parseCardLibrary() {
    try {
        const response = await window.fs.readFile('paste.txt', { encoding: 'utf8' });
        const lines = response.split('\n').map(line => line.trim()).filter(line => line);
        
        const cards = [];
        let i = 0;
        
        while (i < lines.length) {
            const line = lines[i];
            
            // Check if this is the start of a new card
            if (line.includes(' - ') && !line.startsWith('Ability:') && !line.startsWith('Pokémon - ')) {
                const [card, nextIndex] = parseCardBlock(lines, i);
                if (card.name && card.type) {
                    cards.push(card);
                }
                i = nextIndex;
            } else {
                i++;
            }
        }

        // Log some statistics
        console.log(`Total cards: ${cards.length}`);
        console.log(`EX cards: ${cards.filter(c => c.isEx).length}`);
        console.log(`Cards by type:`, cards.reduce((acc, card) => {
            acc[card.type] = (acc[card.type] || 0) + 1;
            return acc;
        }, {}));

        return { cards };
    } catch (error) {
        console.error('Error parsing card library:', error);
        return { cards: [] };
    }
}

parseCardLibrary();