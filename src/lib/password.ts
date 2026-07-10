export function validatePassword(password: string) {
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password)
  )
    throw new Error('A senha deve ter ao menos 8 caracteres, letra maiúscula, minúscula e número.')
  if (password === 'Agz@2025') throw new Error('A senha não pode ser a senha padrão.')
}
