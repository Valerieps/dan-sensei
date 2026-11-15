// The ready-made exercise library that migration 8 inserts (docs/spec/treinos-e-exercicios.md, "Em
// aberto": a ready list so the group tree works on day one; the trainer edits it afterwards).
// Frozen with the migration: changing a shipped migration is forbidden, so a later change to the
// library is a new migration, never an edit of this list.
//
// One exercise per line: `name;alias;alias | primary groups | secondary groups | equipment | load step
// in kg | measure | tags`. Groups and tags are space separated. Trailing fields may be left out.
// Equipment: h dumbbell, b barbell, m machine or cable, k kettlebell, e band, c bodyweight.
// Measure: l load and reps (default), p bodyweight and reps (default for c), t time, d distance.
import { DEFAULT_LOAD_STEP_G, searchKey, type Equipment, type Measure } from '../../src/domain/treinos';

const EQUIPMENT: Record<string, Equipment> = { h: 'dumbbell', b: 'barbell', m: 'machine', k: 'kettlebell', e: 'band', c: 'bodyweight' };
const MEASURE: Record<string, Measure> = { l: 'load_reps', p: 'bodyweight_reps', t: 'time', d: 'distance' };
const DEFAULT_STEP_KG: Record<Equipment, number> = { dumbbell: 2, barbell: 5, machine: 5, kettlebell: 2, band: 1, bodyweight: 1 };

const LINES = `
Supino reto com barra;supino;bench press|peitoral|triceps ombro|b
Supino inclinado com barra|peitoral ombro|triceps|b
Supino declinado com barra|peitoral|triceps|b
Supino reto com halteres|peitoral|triceps ombro|h
Supino inclinado com halteres|peitoral ombro|triceps|h
Supino na máquina;chest press|peitoral|triceps ombro|m
Crucifixo com halteres;voador com halteres|peitoral|ombro|h
Crucifixo na máquina;peck deck;voador|peitoral|ombro|m
Crossover na polia;cross over|peitoral|ombro|m|2.5
Flexão de braços;flexão|peitoral|triceps ombro abdomen|c
Flexão com joelhos no chão|peitoral|triceps ombro|c
Flexão inclinada|peitoral|triceps ombro|c
Flexão com pés elevados|peitoral ombro|triceps|c
Pullover com halter|peitoral dorsal|triceps|h
Paralelas;mergulho nas paralelas;dips|peitoral triceps|ombro|c
Barra fixa pronada;barra fixa|dorsal|biceps antebraco|c
Barra fixa supinada|dorsal biceps|antebraco|c
Barra fixa assistida|dorsal|biceps|m
Puxada frontal na polia;pulley frente|dorsal|biceps antebraco|m
Puxada com pegada neutra|dorsal|biceps|m
Puxada atrás da nuca|dorsal|biceps ombro|m
Remada curvada com barra|dorsal|biceps trapezio lombar|b
Remada unilateral com halter;serrote|dorsal|biceps trapezio|h|2||unilateral
Remada sentada na polia;remada baixa|dorsal|biceps trapezio|m
Remada na máquina|dorsal|biceps trapezio|m
Remada cavalinho|dorsal|biceps trapezio|b
Remada invertida;remada australiana|dorsal|biceps trapezio|c
Remada com elástico|dorsal|biceps|e
Pulldown com braços estendidos;pulldown|dorsal|triceps|m|2.5
Levantamento terra;terra|gluteo posterior lombar|dorsal trapezio quadriceps antebraco|b
Levantamento terra romeno;stiff|posterior gluteo|lombar antebraco|b
Levantamento terra com halteres|posterior gluteo|lombar antebraco|h
Levantamento terra sumô|gluteo adutores|posterior quadriceps lombar|b
Levantamento terra unilateral;stiff unilateral|posterior gluteo|lombar|h|2||equilíbrio unilateral
Bom dia;good morning|posterior lombar|gluteo|b
Hiperextensão lombar;banco romano|lombar|gluteo posterior|c
Encolhimento com halteres|trapezio|antebraco|h
Encolhimento com barra|trapezio|antebraco|b
Desenvolvimento com halteres|ombro|triceps|h
Desenvolvimento com barra|ombro|triceps|b
Desenvolvimento na máquina|ombro|triceps|m
Desenvolvimento Arnold;Arnold press|ombro|triceps|h
Elevação lateral com halteres;lateral|ombro||h|1
Elevação lateral na polia|ombro||m|1
Elevação lateral na máquina|ombro||m
Elevação frontal com halteres;frontal|ombro|peitoral|h|1
Elevação frontal com anilha|ombro|peitoral|h|2.5
Crucifixo inverso com halteres|ombro trapezio|dorsal|h|1
Crucifixo inverso na máquina;voador inverso|ombro trapezio|dorsal|m
Face pull|ombro trapezio|dorsal biceps|m|2.5
Remada alta|ombro trapezio|biceps|b
Rosca direta com barra|biceps|antebraco|b
Rosca direta com barra W;rosca W|biceps|antebraco|b
Rosca alternada com halteres|biceps|antebraco|h
Rosca martelo|biceps antebraco||h
Rosca concentrada|biceps||h|1
Rosca Scott;rosca no banco Scott|biceps||m
Rosca na polia|biceps|antebraco|m|2.5
Rosca inversa|antebraco biceps||b
Rosca com elástico|biceps||e
Tríceps testa;tríceps francês|triceps||b
Tríceps testa com halteres|triceps||h
Tríceps corda na polia;tríceps pulley|triceps||m|2.5
Tríceps barra reta na polia|triceps||m|2.5
Tríceps francês com halter|triceps||h
Tríceps coice;kickback|triceps||h|1
Tríceps no banco;mergulho no banco|triceps|peitoral ombro|c
Tríceps na máquina|triceps||m
Supino fechado|triceps peitoral|ombro|b
Rosca de punho|antebraco||h|1
Rosca de punho inversa|antebraco||h|1
Agachamento livre;agachamento com barra|quadriceps gluteo|posterior lombar adutores|b
Agachamento frontal|quadriceps|gluteo abdomen|b
Agachamento sumô|gluteo adutores|quadriceps posterior|h
Agachamento goblet;agachamento com halter|quadriceps gluteo|abdomen|h
Agachamento com kettlebell|quadriceps gluteo|abdomen|k
Agachamento no Smith|quadriceps gluteo|posterior|m
Agachamento hack|quadriceps|gluteo|m
Agachamento búlgaro|quadriceps gluteo|adutores posterior|h|2||equilíbrio unilateral
Agachamento pistol;agachamento unilateral|quadriceps gluteo|abdomen|c||p|equilíbrio unilateral
Agachamento com peso corporal;agachamento livre sem carga|quadriceps gluteo|posterior|c
Agachamento com salto|quadriceps gluteo|panturrilha|c||p|explosivo
Agachamento isométrico na parede;cadeirinha|quadriceps|gluteo|c||t|isométrico
Leg press 45;leg press|quadriceps gluteo|posterior adutores|m|5
Leg press horizontal|quadriceps gluteo|posterior adutores|m|5
Cadeira extensora;extensora|quadriceps||m|5
Cadeira flexora;flexora|posterior||m|5
Mesa flexora|posterior||m|5
Flexora em pé|posterior|gluteo|m|5||unilateral
Flexão nórdica|posterior||c||p
Avanço;passada;afundo|quadriceps gluteo|posterior adutores|h|2||unilateral
Avanço com barra|quadriceps gluteo|posterior adutores|b|5||equilíbrio
Passada andando;caminhada com avanço|quadriceps gluteo|posterior|h|2||equilíbrio
Avanço reverso|gluteo quadriceps|posterior|h|2||unilateral
Avanço lateral;afundo lateral|adutores quadriceps|gluteo|h|2||unilateral
Step up;subida no banco|quadriceps gluteo|panturrilha|h|2||equilíbrio unilateral
Elevação pélvica com barra;hip thrust|gluteo|posterior|b|5
Elevação pélvica com peso corporal;ponte de glúteo|gluteo|posterior|c
Elevação pélvica unilateral|gluteo|posterior|c||p|unilateral
Elevação pélvica na máquina|gluteo|posterior|m|5
Elevação pélvica com halter|gluteo|posterior|h|5
Glúteo na polia;coice na polia|gluteo|posterior|m|2.5||unilateral
Coice na máquina|gluteo|posterior|m|5
Coice em quatro apoios;donkey kick|gluteo|posterior|c||p|unilateral
Coice com caneleira|gluteo|posterior|h|1||unilateral
Abdução de quadril na máquina;cadeira abdutora;abdutora|abdutores gluteo||m|5
Abdução de quadril deitado|abdutores gluteo||c||p|unilateral
Abdução com elástico|abdutores gluteo||e
Caminhada lateral com elástico;passo lateral|abdutores gluteo||e
Abdução na polia|abdutores gluteo||m|2.5||unilateral
Adução de quadril na máquina;cadeira adutora;adutora|adutores||m|5
Adução na polia|adutores||m|2.5||unilateral
Adução deitado|adutores||c||p|unilateral
Panturrilha em pé na máquina;gêmeos em pé|panturrilha||m|5
Panturrilha sentado;sóleo|panturrilha||m|5
Panturrilha no leg press|panturrilha||m|5
Panturrilha com halter|panturrilha||h|2||unilateral
Panturrilha no degrau|panturrilha||c||p|unilateral
Abdominal reto;abdominal supra|abdomen||c
Abdominal infra;elevação de pernas|abdomen||c
Abdominal oblíquo;rotação de tronco|abdomen||c
Abdominal remador|abdomen||c
Abdominal na máquina|abdomen||m|5
Abdominal na polia;crunch na polia|abdomen||m|2.5
Abdominal na roda;roda abdominal|abdomen|ombro dorsal|c
Elevação de pernas na barra|abdomen|antebraco|c||p
Prancha;prancha frontal|abdomen|ombro lombar|c||t|isométrico core
Prancha lateral|abdomen|ombro abdutores|c||t|isométrico core
Prancha com toque no ombro|abdomen|ombro|c||p|core equilíbrio
Prancha com elevação de perna|abdomen|gluteo lombar|c||t|isométrico core
Bird dog;pássaro-cachorro|lombar abdomen|gluteo|c||p|core equilíbrio
Dead bug;inseto morto|abdomen||c||p|core
Hollow hold;canoinha|abdomen||c||t|isométrico core
Escalador;mountain climber|abdomen|ombro quadriceps|c||t|core
Pallof press|abdomen|ombro|m|2.5||core
Lenhador na polia;woodchop|abdomen|ombro|m|2.5||core
Giro russo;russian twist|abdomen||h|2
Superman;extensão de coluna|lombar|gluteo|c||p
Swing com kettlebell;swing|gluteo posterior|lombar quadriceps ombro|k|2||explosivo funcional
Turkish get-up;levantamento turco|ombro abdomen|gluteo quadriceps|k|2||funcional equilíbrio
Arremesso de kettlebell;snatch|gluteo posterior ombro|trapezio lombar|k|2||explosivo funcional
Clean com kettlebell|gluteo posterior|trapezio biceps|k|2||explosivo funcional
Desenvolvimento com kettlebell|ombro|triceps|k|2
Remada com kettlebell|dorsal|biceps|k|2
Farmer walk;caminhada do fazendeiro|antebraco trapezio|abdomen gluteo|h|2|d|funcional
Carregada unilateral;suitcase carry|abdomen antebraco|trapezio|h|2|d|core unilateral funcional
Salto no caixote;box jump|quadriceps gluteo|panturrilha|c||p|explosivo
Burpee|peitoral quadriceps|ombro abdomen|c||p|funcional cardio
Polichinelo|panturrilha|ombro quadriceps|c||t|cardio
Corrida na esteira;esteira|quadriceps panturrilha|gluteo posterior|m||d|cardio
Caminhada na esteira inclinada|gluteo panturrilha|quadriceps|m||t|cardio
Bicicleta ergométrica;bike|quadriceps|gluteo panturrilha|m||t|cardio
Elíptico;transport|quadriceps gluteo|panturrilha|m||t|cardio
Remo ergométrico;remo indoor|dorsal quadriceps|biceps posterior|m||t|cardio
Pular corda|panturrilha|ombro|c||t|cardio
Equilíbrio em uma perna|gluteo abdutores|panturrilha|c||t|equilíbrio unilateral
Equilíbrio no bosu|quadriceps gluteo|abdomen panturrilha|c||t|equilíbrio
Mobilidade de quadril;90 90|gluteo adutores||c||t|mobilidade
Mobilidade de ombro com bastão|ombro||c||p|mobilidade
Mobilidade de coluna torácica;gato e vaca|lombar dorsal||c||p|mobilidade
Alongamento de posterior|posterior||c||t|mobilidade
Alongamento de quadríceps|quadriceps||c||t|mobilidade
Alongamento de peitoral|peitoral||c||t|mobilidade
`;

export interface SeedExercise {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly primaryGroups: readonly string[];
  readonly secondaryGroups: readonly string[];
  readonly tags: readonly string[];
  readonly measure: Measure;
  readonly loadStepG: number;
  readonly equipment: Equipment;
}

const words = (text: string | undefined): string[] => (text ?? '').split(/\s+/).filter(Boolean);

export const SEED_EXERCISES: readonly SeedExercise[] = LINES.split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [names, primary, secondary, equip, step, measure, tags] = line.split('|');
    const [name, ...aliases] = names.split(';').map((part) => part.trim());
    const equipment = EQUIPMENT[equip];
    return {
      name,
      aliases,
      primaryGroups: words(primary),
      secondaryGroups: words(secondary),
      tags: words(tags),
      measure: measure ? MEASURE[measure] : equipment === 'bodyweight' ? 'bodyweight_reps' : 'load_reps',
      loadStepG: step ? Math.round(Number(step) * 1000) : (DEFAULT_STEP_KG[equipment] ?? DEFAULT_LOAD_STEP_G / 1000) * 1000,
      equipment,
    };
  });

const quote = (text: string): string => `'${text.replace(/'/g, "''")}'`;
const json = (list: readonly string[]): string => quote(JSON.stringify(list));

/** The migration's INSERT statements, in groups so no statement grows too large. */
export function seedStatements(createdAt: string): string[] {
  const statements: string[] = [];
  for (let start = 0; start < SEED_EXERCISES.length; start += 50) {
    const rows = SEED_EXERCISES.slice(start, start + 50).map(
      (e, i) =>
        `(${quote(`seed-${String(start + i + 1).padStart(3, '0')}`)}, ${quote(e.name)}, ${quote(searchKey(e.name))}, ${json(e.aliases)}, ${json(e.primaryGroups)}, ${json(e.secondaryGroups)}, ${json(e.tags)}, ${quote(e.measure)}, ${e.loadStepG}, ${quote(e.equipment)}, ${quote(createdAt)})`,
    );
    statements.push(
      `INSERT INTO exercises (id, name, name_key, aliases, primary_groups, secondary_groups, tags, measure, load_step_g, equipment, created_at) VALUES ${rows.join(', ')}`,
    );
  }
  return statements;
}
