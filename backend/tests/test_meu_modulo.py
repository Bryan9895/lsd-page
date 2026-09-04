import unittest

class TestExemplo(unittest.TestCase):
    def test_soma(self):
        self.assertEqual(1 + 1, 2)

if __name__ == '__main__':
    unittest.main()