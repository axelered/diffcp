export const data1 = {
  name: 'Borut',
  age: 30,
  addresses: [
    { type: 'Home', street: 'Boolevard, Downtown', no: 900 },
    { type: 'Office', street: 'Mayden', no: 900 }
  ]
}

export function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}
