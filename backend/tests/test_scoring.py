import pytest

from app.services.scoring import calculate_points, calculate_scorer_points


class TestGroupStage:
    def test_exact_result(self):
        assert calculate_points(2, 1, 2, 1, "GROUP_STAGE") == 3

    def test_exact_draw(self):
        assert calculate_points(1, 1, 1, 1, "GROUP_STAGE") == 3

    def test_correct_sign_home_win(self):
        # Pronostico 2-1, reale 3-0: segno 1 giusto, risultato sbagliato
        assert calculate_points(2, 1, 3, 0, "GROUP_STAGE") == 1

    def test_correct_sign_away_win(self):
        assert calculate_points(0, 1, 1, 3, "GROUP_STAGE") == 1

    def test_correct_sign_draw(self):
        # Pronostico 0-0, reale 2-2: segno X giusto
        assert calculate_points(0, 0, 2, 2, "GROUP_STAGE") == 1

    def test_wrong_prediction(self):
        # Pronostico vittoria casa, reale vittoria ospite
        assert calculate_points(2, 0, 0, 2, "GROUP_STAGE") == 0

    def test_wrong_draw_predicted(self):
        # Pronostico pareggio, reale vittoria casa
        assert calculate_points(1, 1, 2, 0, "GROUP_STAGE") == 0


class TestKnockoutMultipliers:
    @pytest.mark.parametrize("stage", ["LAST_32", "LAST_16", "QUARTER_FINALS"])
    def test_exact_x2(self, stage):
        assert calculate_points(2, 1, 2, 1, stage) == 6

    @pytest.mark.parametrize("stage", ["LAST_32", "LAST_16", "QUARTER_FINALS"])
    def test_sign_x2(self, stage):
        assert calculate_points(1, 0, 3, 1, stage) == 2

    @pytest.mark.parametrize("stage", ["SEMI_FINALS", "THIRD_PLACE", "FINAL"])
    def test_exact_x3(self, stage):
        assert calculate_points(2, 1, 2, 1, stage) == 9

    @pytest.mark.parametrize("stage", ["SEMI_FINALS", "THIRD_PLACE", "FINAL"])
    def test_sign_x3(self, stage):
        assert calculate_points(1, 0, 2, 0, stage) == 3

    def test_wrong_knockout_still_zero(self):
        assert calculate_points(2, 0, 0, 2, "FINAL") == 0

    def test_draw_possible_in_knockout(self):
        # Pareggio dopo supplementari (si va ai rigori): X valido
        assert calculate_points(1, 1, 1, 1, "LAST_16") == 6
        assert calculate_points(0, 0, 1, 1, "LAST_16") == 2


class TestUnknownStage:
    def test_unknown_stage_defaults_x1(self):
        assert calculate_points(2, 1, 2, 1, "PLAYOFFS") == 3


class TestScorerPoints:
    def test_single_hit(self):
        assert calculate_scorer_points([101], [101, 202]) == 2

    def test_single_miss(self):
        assert calculate_scorer_points([999], [101, 202]) == 0

    def test_no_goals(self):
        assert calculate_scorer_points([101], []) == 0

    def test_no_prediction(self):
        assert calculate_scorer_points([], [101]) == 0

    def test_multiple_all_hit(self):
        # previsti 2 marcatori, entrambi hanno segnato -> +4
        assert calculate_scorer_points([101, 202], [101, 202, 303]) == 4

    def test_multiple_partial(self):
        assert calculate_scorer_points([101, 999], [101, 202]) == 2

    def test_doubletta_hit(self):
        # previsti X due volte, X ha fatto doppietta -> +4
        assert calculate_scorer_points([101, 101], [101, 101]) == 4

    def test_doubletta_only_one_goal(self):
        # previsti X due volte ma X ha segnato una volta -> +2
        assert calculate_scorer_points([101, 101], [101, 202]) == 2
