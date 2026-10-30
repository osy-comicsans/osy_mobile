export interface MrzData {
  documentNumber: string;
  dateOfBirth: string;
  expiryDate: string;
  sex: string;
  lastName: string;
  firstName: string;
  checksPass: boolean;
}

const WEIGHTS = [7, 3, 1];

function characterValue(character: string): number {
  if (character === '<') return 0;
  if (character >= '0' && character <= '9') return Number(character);
  return character.charCodeAt(0) - 55;
}

export function checkDigit(text: string): number {
  return [...text].reduce((sum, character, index) => sum + characterValue(character) * WEIGHTS[index % 3], 0) % 10;
}

const clean = (text: string) => text.toUpperCase().replace(/\s/g, '').replace(/[«‹]/g, '<');

// Two-digit years are read as the past, as they are for a date of birth.
function birthDate(yymmdd: string): string {
  const year = Number(yymmdd.slice(0, 2));
  const century = year > new Date().getFullYear() % 100 ? 19 : 20;
  return `${yymmdd.slice(4, 6)}.${yymmdd.slice(2, 4)}.${century}${yymmdd.slice(0, 2)}`;
}

const name = (text: string) => text.replace(/</g, ' ').trim();

// ICAO TD1: three lines of 30 characters. #28 lists the positions.
export function parseMrz(rawLines: string[]): MrzData | null {
  const lines = rawLines.map(clean).filter((line) => /^[A-Z0-9<]{28,32}$/.test(line));
  const first = lines.findIndex((line) => line.startsWith('DL'));
  if (first < 0 || lines.length < first + 3) return null;

  const line1 = lines[first].padEnd(30, '<').slice(0, 30);
  const line2 = lines[first + 1].padEnd(30, '<').slice(0, 30);
  const line3 = lines[first + 2].padEnd(30, '<').slice(0, 30);
  const [lastName, firstName = ''] = line3.split('<<');
  const composite = line1.slice(5, 30) + line2.slice(0, 7) + line2.slice(8, 15) + line2.slice(18, 29);

  return {
    documentNumber: line1.slice(5, 14).replace(/</g, ''),
    dateOfBirth: birthDate(line2.slice(0, 6)),
    expiryDate: line2.slice(8, 14),
    sex: line2[7],
    lastName: name(lastName),
    firstName: name(firstName),
    checksPass: checkDigit(line1.slice(5, 14)) === Number(line1[14])
      && checkDigit(line2.slice(0, 6)) === Number(line2[6])
      && checkDigit(line2.slice(8, 14)) === Number(line2[14])
      && checkDigit(composite) === Number(line2[29]),
  };
}
