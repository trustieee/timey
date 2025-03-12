export const CHORES = [
    'Clean your room',
    'Do laundry',
    'Take out the trash',
    'Make your bed',
    'Practice piano',
].map((chore, index) => {
    return { id: index, text: chore, completed: false }
});