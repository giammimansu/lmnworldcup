/* global window */
// LMN World Cup app — mock data
(function () {
  window.LMN_APP = {
    user: { name: 'Tu', rank: 4, points: 211, precision: 68 },
    matches: [
      { id: 'm1', home: 'Brasile', homeCode: 'BRA', away: 'Germania', awayCode: 'GER', group: 'Gruppo A', time: '21:00', status: 'TIMED', predicted: null },
      { id: 'm2', home: 'Francia', homeCode: 'FRA', away: 'Spagna', awayCode: 'ESP', group: 'Gruppo C', time: 'LIVE', status: 'LIVE', score: { h: 1, a: 1 }, predicted: { h: 2, a: 1 } },
      { id: 'm3', home: 'Italia', homeCode: 'ITA', away: 'Olanda', awayCode: 'NED', group: 'Gruppo B', time: '18:00', status: 'TIMED', predicted: null },
      { id: 'm4', home: 'Argentina', homeCode: 'ARG', away: 'Portogallo', awayCode: 'POR', group: 'Gruppo D', time: '15:00', status: 'FINISHED', score: { h: 2, a: 0 }, predicted: { h: 2, a: 0 }, result: 'esatto' },
      { id: 'm5', home: 'Inghilterra', homeCode: 'ENG', away: 'Belgio', awayCode: 'BEL', group: 'Gruppo E', time: '21:00', status: 'TIMED', predicted: null },
    ],
    leaderboard: [
      { name: 'Marco Rossi', points: 248, trend: 'up', delta: 2 },
      { name: 'Giulia Conte', points: 236, trend: 'up', delta: 1 },
      { name: 'Luca Bianchi', points: 224, trend: 'down', delta: 1 },
      { name: 'Tu', points: 211, trend: 'up', delta: 3, me: true },
      { name: 'Sara Verdi', points: 198, trend: 'same', delta: 0 },
      { name: 'Paolo Neri', points: 187, trend: 'down', delta: 2 },
      { name: 'Elena Russo', points: 173, trend: 'up', delta: 1 },
    ],
  };
})();
